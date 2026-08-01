from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017/ascendly"
    mongodb_secondary_uri: str = ""
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-me"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 30
    frontend_url: str = "http://localhost:3000"
    api_base_url: str = "http://localhost:8000"
    environment: str = "development"

    # Google Drive (legacy — used for migration only)
    google_service_account_json: str = "/home/shieldx/Music/warm-rock-502600-j8-e84315620c82.json"
    drive_root_folder_id: str = "c1_obpXZKZIUtIPHf__DCGvbmcEXv4QJg5"

    # Cloudflare R2 (primary video storage)
    r2_endpoint_url: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "ascendly-videos"
    r2_signed_url_expiry_seconds: int = 3600
    r2_auto_delete_days: int = 1

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_webhook_id: str = ""
    sms_provider_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    from_email: str = "noreply@ascendly.io"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.groq.com/openai/v1"
    openai_model: str = "llama-3.3-70b-versatile"

    # OpenRouter (free models available)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "nvidia/nemotron-3-super-120b-a12b:free"

    # Google Gemini (free tier via Google AI Studio)
    gemini_api_key: str = ""
    gemini_model: str = "nvidia/nemotron-3-super-120b-a12b:free"

    # Web search for AI content generation (optional but recommended)
    # Tavily is recommended for AI/RAG: https://tavily.com
    tavily_api_key: str = ""
    # Google Custom Search + CSE ID (free tier available)
    google_search_api_key: str = ""
    google_search_cse_id: str = ""
    # SerpAPI (Google search via API)
    serpapi_api_key: str = ""
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""

    # Meilisearch
    meili_url: str = "http://localhost:7700"
    meili_master_key: str = "ascendly-dev-master-key"

    # Worker / Background Jobs
    worker_max_retries: int = 5
    worker_keep_result_seconds: int = 3600
    worker_poll_delay: float = 0.5
    worker_max_burst_jobs: int = 10

    # Sentry Error Tracking
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1

    # Telemetry / Observability
    telemetry_enabled: bool = True
    telemetry_environment: str = "development"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "https://*.cloudshell.dev"]
    
    # Security
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "*.ascendly.io"]

    # Error Logging
    error_log_dir: str = "logs/errors"
    error_log_max_file_size_mb: int = 100
    error_log_retention_days: int = 30
    error_log_to_mongodb: bool = True

    # Dev/test bypass for subscription checks on video streaming
    bypass_subscription_check: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"


settings = Settings()
