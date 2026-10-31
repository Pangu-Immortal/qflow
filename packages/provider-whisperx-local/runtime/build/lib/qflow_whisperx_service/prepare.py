from __future__ import annotations

import argparse
from pathlib import Path

from .resources import prepare_punkt_tab, assert_sentence_data
from .config import ServiceConfig
from .models import prepare_models, alignment_selection
from dataclasses import replace


def main() -> None:
    config = ServiceConfig.from_environment()
    parser = argparse.ArgumentParser(description="Prepare the selected WhisperX models and sentence data")
    parser.add_argument(
        "--nltk-data",
        type=Path,
        default=config.nltk_data_root,
        help="NLTK data root (defaults to the SVML user cache)",
    )
    arguments = parser.parse_args()
    config = replace(config, nltk_data_root=arguments.nltk_data)
    for language in config.alignment_languages:
        if config.model.endswith(".en") and language != "en":
            raise ValueError(f"ASR model {config.model!r} is English-only; select a multilingual model to prepare {language}")
        alignment_selection(language)
    path = prepare_punkt_tab(arguments.nltk_data)
    for language in config.alignment_languages:
        try:
            assert_sentence_data(arguments.nltk_data, language)
        except RuntimeError:
            import nltk
            if not nltk.download("punkt_tab", download_dir=str(arguments.nltk_data), quiet=False, force=True, raise_on_error=True):
                raise RuntimeError("NLTK could not prepare sentence data")
            assert_sentence_data(arguments.nltk_data, language)
    prepare_models(config)
    print(path)
