'use client';

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FORK_RELEASE } from "@/lib/fork-release";
import { cn } from "@/lib/utils";

// Always shows this fork's latest release. The whole strip opens a short summary.
export default function UpdateBanner({ className }: { className?: string }) {
    return (
        <Dialog>
            <DialogTrigger
                className={cn(
                    'group flex w-full items-center gap-2.5 rounded-[12px] bg-brand-soft/50 py-1.5 ps-2 pe-3 text-start text-[13px] shadow-[inset_0_0_0_1px_oklch(0.8_0.13_176/0.25)] transition-colors hover:bg-brand-soft/80',
                    className,
                )}
            >
                <span className="pill is-brand shrink-0">חדש</span>
                <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold text-foreground">{FORK_RELEASE.title}:</span>{' '}
                    <span className="text-muted-foreground">{FORK_RELEASE.summary}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 font-semibold text-brand-ink">
                    <span className="max-sm:hidden">מה חדש</span>
                    <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                </span>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <div>
                    <p className="kicker text-brand-ink">{FORK_RELEASE.date}</p>
                    <DialogTitle className="mt-1.5 text-[22px] font-bold tracking-[-0.03em]">{FORK_RELEASE.title}</DialogTitle>
                    <DialogDescription className="mt-1 text-[14px] text-muted-foreground">{FORK_RELEASE.summary}.</DialogDescription>
                </div>
                <ul className="flex flex-col gap-2.5 text-[14px] leading-relaxed">
                    {FORK_RELEASE.highlights.map((item) => (
                        <li key={item} className="flex gap-2.5">
                            <Check className="mt-1 size-4 flex-none text-brand-ink" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
                {/* Closes the modal too: the banner stays mounted across navigations */}
                <DialogClose asChild>
                    <Link href={FORK_RELEASE.href} className="btn btn-primary h-10 w-full">
                        {FORK_RELEASE.cta} <ArrowLeft />
                    </Link>
                </DialogClose>
            </DialogContent>
        </Dialog>
    );
}
