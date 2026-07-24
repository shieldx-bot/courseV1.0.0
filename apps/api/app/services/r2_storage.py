import logging
from datetime import timedelta
from typing import BinaryIO

import boto3
from botocore.config import Config as BotoConfig

from app.core.config import settings

logger = logging.getLogger(__name__)


class R2Storage:
    def __init__(self):
        self.client = None
        self._initialized = False

    async def ensure_client(self):
        if self._initialized:
            return
        if not settings.r2_endpoint_url:
            logger.warning("R2 not configured — endpoint URL is empty")
            return
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=BotoConfig(signature_version="s3v4", connect_timeout=10, read_timeout=30),
        )
        self._initialized = True
        logger.info("R2 storage client initialized")

    def _key(self, lesson_id: str) -> str:
        return f"videos/{lesson_id}.mp4"

    async def upload(self, lesson_id: str, data: bytes, content_type: str = "video/mp4") -> str:
        await self.ensure_client()
        key = self._key(lesson_id)
        self.client.put_object(
            Bucket=settings.r2_bucket_name,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        logger.info("Uploaded %s to R2 bucket %s", key, settings.r2_bucket_name)
        return key

    async def upload_from_url(self, lesson_id: str, download_url: str) -> str:
        import httpx
        await self.ensure_client()
        async with httpx.AsyncClient() as client:
            resp = await client.get(download_url, timeout=120.0)
            resp.raise_for_status()
            return await self.upload(lesson_id, resp.content)

    async def generate_signed_url(self, lesson_id: str, expires_in: int = 3600) -> str | None:
        await self.ensure_client()
        if not self.client:
            return None
        key = self._key(lesson_id)
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.r2_bucket_name, "Key": key},
                ExpiresIn=expires_in,
            )
            return url
        except Exception as exc:
            logger.error("Failed to generate signed URL for %s: %s", key, exc)
            return None

    async def delete(self, lesson_id: str) -> bool:
        await self.ensure_client()
        if not self.client:
            return False
        key = self._key(lesson_id)
        try:
            self.client.delete_object(Bucket=settings.r2_bucket_name, Key=key)
            logger.info("Deleted %s from R2", key)
            return True
        except Exception as exc:
            logger.error("Failed to delete %s: %s", key, exc)
            return False

    async def object_exists(self, lesson_id: str) -> bool:
        await self.ensure_client()
        if not self.client:
            return False
        key = self._key(lesson_id)
        try:
            self.client.head_object(Bucket=settings.r2_bucket_name, Key=key)
            return True
        except Exception:
            return False

    async def list_all(self) -> list[dict]:
        await self.ensure_client()
        if not self.client:
            return []
        objs = self.client.list_objects_v2(Bucket=settings.r2_bucket_name, Prefix="videos/")
        return objs.get("Contents", [])

    async def set_bucket_lifecycle(self):
        """Set a lifecycle rule to auto-delete objects after 1 day."""
        await self.ensure_client()
        if not self.client:
            return
        try:
            self.client.put_bucket_lifecycle_configuration(
                Bucket=settings.r2_bucket_name,
                LifecycleConfiguration={
                    "Rules": [
                        {
                            "ID": "auto-delete-1-day",
                            "Status": "Enabled",
                            "Filter": {"Prefix": "videos/"},
                            "Expiration": {"Days": settings.r2_auto_delete_days},
                        }
                    ]
                },
            )
            logger.info("Set R2 lifecycle: auto-delete after %d days", settings.r2_auto_delete_days)
        except Exception as exc:
            logger.warning("Could not set R2 lifecycle rules (may need dashboard config): %s", exc)


r2_storage = R2Storage()
