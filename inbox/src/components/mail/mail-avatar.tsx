/* eslint-disable @next/next/no-img-element */
"use client";

import { getInitials } from "@/lib/utils";

type MailAvatarProps = {
  avatarUrl?: string | null;
  email?: string | null;
  name?: string | null;
};

export function MailAvatar({ avatarUrl, email, name }: MailAvatarProps) {
  const initials = getInitials(name, email);

  return (
    <div aria-hidden className="tron-mail-avatar">
      {avatarUrl ? <img alt="" src={avatarUrl} /> : initials}
    </div>
  );
}
