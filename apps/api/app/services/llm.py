"""Centralized LLM service supporting multiple providers with automatic fallback.

Supported providers (in priority order):
1. OpenRouter - free models available (meta-llama/llama-4-maverick:free, etc.)
2. Google Gemini - free tier via Google AI Studio
3. Groq - fast inference with free tier
4. OpenAI - paid fallback

Usage:
    from app.services.llm import call_llm, is_llm_available

    response = await call_llm(
        messages=[{"role": "user", "content": "Hello!"}],
        max_tokens=500,
        temperature=0.7,
    )
"""

import json
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Provider priority list (first available provider wins)
_PROVIDER_PRIORITY = ["openrouter", "gemini", "groq", "openai"]

# Strong model recommendations per provider, ordered by preference for content quality
_MODEL_PRIORITY = {
    "openrouter": [
        "nvidia/nemotron-3-super-120b-a12b:free",
        "google/gemini-2.5-pro-exp-03-25",
        "anthropic/claude-3.7-sonnet:thinking",
        "meta-llama/llama-4-maverick:free",
        "openai/gpt-4o-mini",
    ],
    "gemini": [
        "gemini-2.5-pro-exp-03-25",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro",
    ],
    "groq": [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "gemma2-9b-it",
    ],
    "openai": [
        "gpt-4o-mini",
        "gpt-4o",
        "gpt-3.5-turbo",
    ],
}

# Best model/ provider preference per task type
_CONTENT_MODEL_PREFERENCE = {
    "course_content": ["openrouter"],
    "quiz": ["openrouter"],
    "code": ["openrouter"],
    "tutor": ["openrouter"],
    "analytics": ["openrouter"],
}

_GLOBAL_OPENROUTER_MODEL_FALLBACK = "nvidia/nemotron-3-super-120b-a12b:free"


class LLMProvider:
    """Base class for LLM providers."""

    name: str = "base"

    async def call(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> str:
        raise NotImplementedError

    async def stream(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Any:
        """Yield content chunks as they are generated. Default: single chunk."""
        raise NotImplementedError

    def is_available(self) -> bool:
        return False


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

    def _get_api_key(self) -> str | None:
        return settings.openrouter_api_key or settings.openai_api_key

    def _get_base_url(self) -> str:
        return settings.openrouter_base_url or "https://openrouter.ai/api/v1"

    def _get_model(self) -> str:
        models = _MODEL_PRIORITY["openrouter"]
        configured = settings.openrouter_model or "meta-llama/llama-4-maverick:free"
        if configured in models:
            return configured
        for m in models:
            if m:
                return m
        return configured

    def is_available(self) -> bool:
        return bool(self._get_api_key())

    async def call(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> str:
        api_key = self._get_api_key()
        if not api_key:
            raise ValueError("OpenRouter API key not configured")

        url = f"{self._get_base_url()}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.frontend_url or "http://localhost:3000",
            "X-Title": "Ascendly",
        }
        payload: dict[str, Any] = {
            "model": self._get_model(),
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if response_format:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if "choices" not in data:
            raise ValueError(f"Unexpected OpenRouter response: {data}")
        return data["choices"][0]["message"]["content"] or ""

    async def stream(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Any:
        async for chunk in _stream_openai_compatible(
            self, messages, max_tokens, temperature, response_format
        ):
            yield chunk


class GeminiProvider(LLMProvider):
    name = "gemini"

    def _get_api_key(self) -> str | None:
        return settings.gemini_api_key

    def _get_model(self) -> str:
        models = _MODEL_PRIORITY["gemini"]
        configured = settings.gemini_model
        if configured in models:
            return configured
        for m in models:
            if m:
                return m
        return configured or models[0]

    def is_available(self) -> bool:
        return bool(self._get_api_key())

    async def call(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> str:
        api_key = self._get_api_key()
        if not api_key:
            raise ValueError("Gemini API key not configured")

        model = self._get_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        # Convert OpenAI-style messages to Gemini format
        system_instruction = ""
        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_instruction = content
                continue
            parts = [{"text": content}]
            contents.append({"role": "user" if role == "user" else "model", "parts": parts})

        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        if response_format and response_format.get("type") == "json_object":
            payload["generationConfig"]["responseMimeType"] = "application/json"

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError(f"No candidates in Gemini response: {data}")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts)
        if not text:
            raise ValueError("Empty response from Gemini")
        return text

    async def stream(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Any:
        async for chunk in _stream_gemini(
            self, messages, max_tokens, temperature, response_format
        ):
            yield chunk


class GroqProvider(LLMProvider):
    name = "groq"

    def _get_api_key(self) -> str | None:
        return settings.openai_api_key

    def _get_base_url(self) -> str:
        return settings.openai_base_url or "https://api.groq.com/openai/v1"

    def _get_model(self) -> str:
        models = _MODEL_PRIORITY["groq"]
        configured = settings.openai_model
        if configured in models:
            return configured
        for m in models:
            if m:
                return m
        return configured or models[0]

    def is_available(self) -> bool:
        return bool(self._get_api_key())

    async def call(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> str:
        api_key = self._get_api_key()
        if not api_key:
            raise ValueError("Groq API key not configured")

        url = f"{self._get_base_url()}/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload: dict[str, Any] = {
            "model": self._get_model(),
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if response_format:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if "choices" not in data:
            raise ValueError(f"Unexpected Groq response: {data}")
        return data["choices"][0]["message"]["content"] or ""

    async def stream(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Any:
        async for chunk in _stream_openai_compatible(
            self, messages, max_tokens, temperature, response_format
        ):
            yield chunk


class OpenAIProvider(LLMProvider):
    name = "openai"

    def _get_api_key(self) -> str | None:
        return settings.openai_api_key

    def _get_base_url(self) -> str:
        return "https://api.openai.com/v1"

    def _get_model(self) -> str:
        models = _MODEL_PRIORITY["openai"]
        configured = settings.openai_model
        if configured in models:
            return configured
        for m in models:
            if m:
                return m
        return configured or models[0]

    def is_available(self) -> bool:
        return bool(self._get_api_key()) and not settings.openai_base_url.startswith("https://api.groq.com")

    async def call(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> str:
        api_key = self._get_api_key()
        if not api_key:
            raise ValueError("OpenAI API key not configured")

        try:
            import openai

            client = openai.OpenAI(api_key=api_key, base_url=self._get_base_url())
            response = client.chat.completions.create(
                model=self._get_model(),
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except ImportError:
            url = f"{self._get_base_url()}/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload: dict[str, Any] = {
                "model": self._get_model(),
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
            if response_format:
                payload["response_format"] = response_format

            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            if "choices" not in data:
                raise ValueError(f"Unexpected OpenAI response: {data}")
            return data["choices"][0]["message"]["content"] or ""

    async def stream(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Any:
        async for chunk in _stream_openai_compatible(
            self, messages, max_tokens, temperature, response_format
        ):
            yield chunk


_PROVIDERS: list[LLMProvider] = [
    OpenRouterProvider(),
    GeminiProvider(),
    GroqProvider(),
    OpenAIProvider(),
]


async def _stream_openai_compatible(
    provider: LLMProvider,
    messages: list[dict[str, str]],
    max_tokens: int,
    temperature: float,
    response_format: dict[str, Any] | None,
) -> Any:
    """Stream an OpenAI-style ``chat/completions`` endpoint via SSE."""
    api_key = provider._get_api_key()
    if not api_key:
        raise ValueError(f"{provider.name} API key not configured")

    url = f"{provider._get_base_url()}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider.name == "openrouter":
        headers["HTTP-Referer"] = settings.frontend_url or "http://localhost:3000"
        headers["X-Title"] = "Ascendly"

    payload: dict[str, Any] = {
        "model": provider._get_model(),
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True,
    }
    if response_format:
        payload["response_format"] = response_format

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {}).get("content")
                    if delta:
                        yield delta
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue


async def _stream_gemini(
    provider: LLMProvider,
    messages: list[dict[str, str]],
    max_tokens: int,
    temperature: float,
    response_format: dict[str, Any] | None,
) -> Any:
    """Stream Google Gemini's ``streamGenerateContent?alt=sse`` endpoint."""
    api_key = provider._get_api_key()
    if not api_key:
        raise ValueError("Gemini API key not configured")

    model = provider._get_model()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
        f"?alt=sse&key={api_key}"
    )

    system_instruction = ""
    contents = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "system":
            system_instruction = content
            continue
        contents.append({"role": "user" if role == "user" else "model", "parts": [{"text": content}]})

    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature,
        },
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
    if response_format and response_format.get("type") == "json_object":
        payload["generationConfig"]["responseMimeType"] = "application/json"

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if not data:
                    continue
                try:
                    obj = json.loads(data)
                    candidates = obj.get("candidates", [])
                    if not candidates:
                        continue
                    parts = candidates[0].get("content", {}).get("parts", [])
                    text = "".join(p.get("text", "") for p in parts)
                    if text:
                        yield text
                except json.JSONDecodeError:
                    continue


def _get_available_providers() -> list[LLMProvider]:
    return [p for p in _PROVIDERS if p.is_available()]


def is_llm_available() -> bool:
    return bool(_get_available_providers())


def get_active_provider() -> LLMProvider | None:
    available = _get_available_providers()
    return available[0] if available else None


async def call_llm(
    messages: list[dict[str, str]],
    max_tokens: int = 1000,
    temperature: float = 0.7,
    response_format: dict[str, Any] | None = None,
    *,
    provider_override: str | None = None,
) -> str:
    """Call the LLM with automatic provider fallback.

    Tries providers in priority order: OpenRouter → Gemini → Groq → OpenAI.
    Falls back to the next provider if the current one fails.
    """
    providers = _get_available_providers()
    if not providers:
        raise ValueError(
            "No LLM provider configured. Set OPENROUTER_API_KEY, GEMINI_API_KEY, "
            "or OPENAI_API_KEY in .env"
        )

    errors: list[str] = []
    for provider in providers:
        if provider_override and provider.name != provider_override:
            continue
        try:
            logger.info("Calling LLM provider: %s", provider.name)
            return await provider.call(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                response_format=response_format,
            )
        except Exception as e:
            logger.warning("LLM provider %s failed: %s", provider.name, e)
            errors.append(f"{provider.name}: {e}")
            continue

    raise ValueError(f"All LLM providers failed: {'; '.join(errors)}")


async def call_llm_stream(
    messages: list[dict[str, str]],
    max_tokens: int = 1000,
    temperature: float = 0.7,
    response_format: dict[str, Any] | None = None,
    *,
    provider_override: str | None = None,
) -> Any:
    """Stream an LLM response with automatic provider fallback.

    Yields text chunks as they arrive. If a provider fails mid-stream, the
    remaining providers are tried (chunks already yielded are preserved).
    """
    providers = _get_available_providers()
    if not providers:
        raise ValueError(
            "No LLM provider configured. Set OPENROUTER_API_KEY, GEMINI_API_KEY, "
            "or OPENAI_API_KEY in .env"
        )

    errors: list[str] = []
    for provider in providers:
        if provider_override and provider.name != provider_override:
            continue
        try:
            logger.info("Streaming from LLM provider: %s", provider.name)
            async for chunk in provider.stream(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                response_format=response_format,
            ):
                yield chunk
            return
        except Exception as e:
            logger.warning("LLM stream provider %s failed: %s", provider.name, e)
            errors.append(f"{provider.name}: {e}")
            continue

    raise ValueError(f"All LLM providers failed: {'; '.join(errors)}")
