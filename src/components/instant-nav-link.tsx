"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

type InstantNavLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: string;
  children: ReactNode;
};

export function InstantNavLink({
  href,
  children,
  prefetch = true,
  ...props
}: InstantNavLinkProps) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }

    e.preventDefault();
    router.push(href);
  };

  return (
    <Link href={href} prefetch={prefetch} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
