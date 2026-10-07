from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "runtime" / "src"))
from qflow_whisperx_service.config import ServiceConfig
from qflow_whisperx_service.models import asr_path, use_local_resources_only, alignment_selection
from qflow_whisperx_service.engine import WhisperXEngine, InferenceInputError
from qflow_whisperx_service.resources import assert_sentence_data


class ResourceBoundaryTests(unittest.TestCase):
    def test_language_selects_the_pinned_upstreams_alignment_model(self):
        from whisperx.alignment import DEFAULT_ALIGN_MODELS_HF, DEFAULT_ALIGN_MODELS_TORCH
        self.assertEqual(alignment_selection("ko"), ("huggingface", DEFAULT_ALIGN_MODELS_HF["ko"]))
        self.assertEqual(alignment_selection("en"), ("torchaudio", DEFAULT_ALIGN_MODELS_TORCH["en"]))

    def test_unsupported_language_and_english_only_asr_fail_before_inference(self):
        engine = WhisperXEngine.__new__(WhisperXEngine)
        engine._config = ServiceConfig.from_environment({})
        with self.assertRaisesRegex(InferenceInputError, "no default alignment model"):
            engine.transcribe(None, "zzz")
        engine._config = ServiceConfig.from_environment({"QFLOW_WHISPERX_MODEL": "small.en"})
        with self.assertRaisesRegex(InferenceInputError, "English-only"):
            engine.transcribe(None, "ko")

    def test_missing_asr_uses_local_cache_only(self):
        with tempfile.TemporaryDirectory() as root:
            config = ServiceConfig.from_environment({"QFLOW_WHISPERX_MODEL_CACHE": root})
            with patch("faster_whisper.utils.download_model", side_effect=FileNotFoundError("empty cache")) as download:
                with self.assertRaisesRegex(RuntimeError, "not prepared"):
                    asr_path(config)
                self.assertTrue(download.call_args.kwargs["local_files_only"])

    def test_inference_refuses_upstream_torch_and_nltk_downloads(self):
        import nltk
        import torch.hub
        nltk_download = nltk.download
        torch_download = torch.hub.download_url_to_file
        try:
            use_local_resources_only()
            with self.assertRaisesRegex(RuntimeError, "not prepared"):
                nltk.download("punkt_tab")
            with tempfile.TemporaryDirectory() as root:
                # Exercise torch's real cache-miss path, with no server/network.
                with self.assertRaisesRegex(RuntimeError, "not prepared"):
                    torch.hub.load_state_dict_from_url("https://example.invalid/missing.pt", model_dir=root)
        finally:
            nltk.download = nltk_download
            torch.hub.download_url_to_file = torch_download

    def test_existing_sentence_directory_does_not_hide_missing_language_files(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)
            (path / "tokenizers" / "punkt_tab" / "english").mkdir(parents=True)
            with self.assertRaisesRegex(RuntimeError, "sentence data"):
                assert_sentence_data(path, "en")

    def test_local_asr_directory_requires_tokenizer_before_execution(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)
            (path / "model.bin").write_bytes(b"weights")
            (path / "config.json").write_text("{}")
            config = ServiceConfig.from_environment({"QFLOW_WHISPERX_MODEL": root})
            with self.assertRaisesRegex(RuntimeError, "tokenizer.json"):
                asr_path(config)


if __name__ == "__main__":
    unittest.main()
