"""WhisperX-owned model selection and explicit preparation.

The pinned upstream libraries own their model tables and cache formats. The service
uses those same caches, but has no authority to fetch missing execution resources.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse
from typing import TYPE_CHECKING
from .resources import UnpreparedResourceError

if TYPE_CHECKING:
    from .config import ServiceConfig


def missing_resource(subject: str) -> UnpreparedResourceError:
    return UnpreparedResourceError(f"{subject} is not prepared; run qflow programs prepare --endpoint <your-whisperx-endpoint> with the selected model and alignmentLanguages")


def forbid_inference_downloads(*args: object, **kwargs: object) -> None:
    raise missing_resource("A WhisperX execution resource")


def use_local_resources_only() -> None:
    # This is the dedicated inference process, not the preparation process or Host.
    # WhisperX 3.8.6 has no no-download option for its torchaudio and NLTK branches.
    # Refuse at their download boundary as well as using HF's local-files-only API.
    import nltk
    import torch.hub
    nltk.download = forbid_inference_downloads
    torch.hub.download_url_to_file = forbid_inference_downloads


def hf_cache(config: ServiceConfig) -> str | None:
    return str(config.model_cache / "huggingface") if config.model_cache is not None else None


def torch_cache(config: ServiceConfig) -> Path:
    if config.model_cache is not None:
        return config.model_cache / "torch"
    import torch.hub
    return Path(torch.hub.get_dir()) / "checkpoints"


def alignment_selection(language: str) -> tuple[str, str]:
    from whisperx.alignment import DEFAULT_ALIGN_MODELS_HF, DEFAULT_ALIGN_MODELS_TORCH
    if language in DEFAULT_ALIGN_MODELS_TORCH:
        return "torchaudio", DEFAULT_ALIGN_MODELS_TORCH[language]
    if language in DEFAULT_ALIGN_MODELS_HF:
        return "huggingface", DEFAULT_ALIGN_MODELS_HF[language]
    raise ValueError(f"WhisperX has no default alignment model for language {language!r}")


def asr_path(config: ServiceConfig, *, prepare: bool = False) -> str:
    if prepare:
        try:
            return asr_path(config)
        except RuntimeError:
            pass
    if Path(config.model).is_dir():
        path = Path(config.model).resolve()
    else:
        from faster_whisper.utils import download_model
        try:
            path = Path(download_model(config.model, cache_dir=hf_cache(config), local_files_only=not prepare))
        except Exception as error:
            if prepare:
                raise
            raise missing_resource(f"ASR model {config.model!r}") from error
    for name in ("model.bin", "config.json", "tokenizer.json"):
        if not (path / name).is_file():
            raise missing_resource(f"ASR model {config.model!r}: {name}")
    return str(path)


def alignment_path(config: ServiceConfig, language: str) -> tuple[str, str]:
    kind, name = alignment_selection(language)
    if kind == "torchaudio":
        import torchaudio
        bundle = getattr(torchaudio.pipelines, name)
        # The pinned torchaudio bundle owns its checkpoint URL. Its cache uses
        # that URL's basename; do not duplicate the language or URL table here.
        checkpoint = torch_cache(config) / Path(urlparse(bundle._path).path).name
        if not checkpoint.is_file():
            raise missing_resource(f"Alignment model {name!r} for {language}")
        return kind, name
    from huggingface_hub import snapshot_download
    try:
        path = Path(snapshot_download(name, cache_dir=hf_cache(config), local_files_only=True))
    except Exception as error:
        raise missing_resource(f"Alignment model {name!r} for {language}") from error
    weights = any((path / item).is_file() for item in (
        "model.safetensors", "pytorch_model.bin", "model.safetensors.index.json", "pytorch_model.bin.index.json",
    ))
    if not weights or not (path / "config.json").is_file():
        raise missing_resource(f"Alignment model {name!r} for {language}")
    # Actually read tokenizer/processor resources, not only the cache directory.
    from transformers import Wav2Vec2Processor
    try:
        Wav2Vec2Processor.from_pretrained(str(path), local_files_only=True)
    except (OSError, ValueError) as error:
        raise missing_resource(f"Alignment processor {name!r} for {language}") from error
    return kind, str(path)


def check_models(config: ServiceConfig) -> None:
    asr_path(config)
    from .resources import assert_sentence_data
    for language in config.alignment_languages:
        alignment_path(config, language)
        assert_sentence_data(config.nltk_data_root, language)


def prepare_models(config: ServiceConfig) -> None:
    print(f"Preparing ASR model {config.model}", flush=True)
    asr_path(config, prepare=True)
    from whisperx import load_align_model
    for language in config.alignment_languages:
        kind, name = alignment_selection(language)
        try:
            alignment_path(config, language)
        except RuntimeError:
            print(f"Preparing alignment model {name} for {language}", flush=True)
            cache = str(torch_cache(config)) if kind == "torchaudio" else hf_cache(config)
            if cache is not None:
                Path(cache).mkdir(parents=True, exist_ok=True)
            # Upstream downloads and loads the exact selected checkpoint; the
            # returned model is discarded here, not kept in the service's RAM.
            load_align_model(language_code=language, device="cpu", model_dir=cache)
            alignment_path(config, language)
