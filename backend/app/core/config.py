from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./signal.db"
    secret_key: str = "dev-secret-key-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 7 * 24 * 60
    otp_code: str = "123456"
    frontend_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def sqlalchemy_database_url(self) -> str:
        """Normalize host-provided Postgres URLs for SQLAlchemy + psycopg v3."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
