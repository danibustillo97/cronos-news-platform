from __future__ import annotations

import os

from app.domain.distribution.entities import Platform


class EnvPublishingAvailability:
    """Honest "is this platform actually wired up" check — env credential
    presence today, a real adapter registry once more platforms exist."""

    def is_connected(self, platform: Platform) -> bool:
        if platform == Platform.TIKTOK:
            return bool(os.getenv("TIKTOK_CLIENT_KEY") and os.getenv("TIKTOK_CLIENT_SECRET"))
        if platform == Platform.WEB:
            return True  # the existing `news` table + public site IS the Web adapter
        return False  # INSTAGRAM / FACEBOOK / YOUTUBE — no adapter exists yet
