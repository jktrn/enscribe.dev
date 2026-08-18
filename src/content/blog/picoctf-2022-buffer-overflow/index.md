---
title: 'picoCTF 2022: “Buffer Overflow” Series'
description: 'A comprehensive walkthrough of the picoCTF 2022 buffer overflow challenges, exploring stack-based exploitation techniques and binary security fundamentals.'
date: 2022-06-16
tags: ['ctf', 'pwn']
banner:
  light: './assets/banner-light.svg'
  dark: './assets/banner-dark.svg'
authors: ['enscribe']
---

## Introduction

This is a writeup for the buffer overflow series during the **picoCTF 2022** competition. This was arguably my favorite set of challenges, as beforehand I'd never stepped into the realm of binary exploitation/pwn. I learned a lot from this, so I highly recommend solving it by yourself before referencing this document. Cheers!

Each challenge will be a subpost of this one. Click the following button or use the sidebar (navbar if you're on mobile) to navigate to the next challenge:

<style>
challenge-info {
  --row-border: color-mix(in oklab, var(--muted-foreground) 30%, transparent);

  display: block;
  margin-block: 0 1em;
  padding: var(--space-xs) var(--space-s);
  border: 2px solid var(--border);
  font-size: var(--step--1);

  challenge-title {
    display: block;
    padding-block-end: var(--space-3xs);
    color: var(--foreground);
    font-weight: var(--font-weight-medium);
  }

  dl {
    display: flex;
    flex-direction: column;
    margin-block: 0;

    > div {
      display: flex;
      align-items: baseline;
      gap: var(--space-s);
      padding-block: var(--space-3xs);

      &:not(:last-child) {
        border-block-end: 1.5px solid var(--row-border);
      }
    }
  }

  dt {
    flex: 1;
    color: var(--muted-foreground);
    font-weight: var(--font-weight-medium);
  }

  dd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3xs);
    flex: 2;
    margin: 0;
    word-break: break-word;

    img {
      display: inline-block;
      margin: 0;
      border-radius: var(--radius-full);
      inline-size: 1em;
      block-size: 1em;
    }

    a {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    > p {
      margin-block: 0;
    }
  }

  > dl + p,
  > dl ~ * {
    margin-block: var(--space-2xs) 0;
  }
}

challenge-flag {
  word-break: break-all;
  filter: blur(4px);
  transition: filter 0.2s;
  user-select: all;

  &:hover {
    filter: none;
  }
}
</style>
