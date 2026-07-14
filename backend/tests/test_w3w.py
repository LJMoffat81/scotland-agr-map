from spatial.w3w import is_configured, normalise_words, try_coordinates_to_words


def test_normalise_words_accepts_slashes():
    assert normalise_words("///Filled.Count.Soap") == "filled.count.soap"


def test_normalise_words_rejects_bad_shape():
    import pytest

    with pytest.raises(ValueError):
        normalise_words("only.two")


def test_try_coordinates_without_key_returns_none(monkeypatch):
    monkeypatch.delenv("W3W_API_KEY", raising=False)
    assert is_configured() is False
    assert try_coordinates_to_words(55.9533, -3.1883) is None
