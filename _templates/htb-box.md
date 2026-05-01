---
title: HTB — <Box Name>
date: 2026-01-01
type: htb
box: <Box Name>
os: linux
difficulty: easy
points: 20
released: 2017-01-01
retired: 2017-12-31
makers: [maker1]
ip: 10.10.10.10
tools: [nmap, gobuster]
cves: [CVE-0000-0000]
tags: [htb, writeup]
excerpt: One-line summary of the box and the path to root.
---

## TL;DR

A 2-3 sentence summary: how you got user, how you got root, the key insight.

## Recon

### nmap

```bash
nmap -p- --min-rate 5000 -sV -sC -oA scans/initial 10.10.10.10
```

Brief notes on what the scan revealed.

### Web enumeration

Notes on directories, technologies, leaked info, etc.

## Shell as user

The path to the first foothold. Vulnerability, exploit, payload.

```bash
# example exploit invocation
```

## Shell as root

Privilege escalation path. What was misconfigured / vulnerable, how it was exploited.

```bash
# privesc command
```

## Beyond root

Optional: cleanup, what else was on the box, persistence mechanisms, anything interesting that wasn't on the critical path.

## Lessons

- One-line takeaway #1
- One-line takeaway #2
