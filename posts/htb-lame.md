---
title: HTB — Lame
date: 2026-05-01
type: htb
box: Lame
os: linux
difficulty: easy
points: 20
released: 2017-03-14
retired: 2017-05-26
makers: [ch4p]
ip: 10.10.10.3
tools: [nmap, smbclient, metasploit]
cves: [CVE-2007-2447, CVE-2004-2687]
tags: [htb, writeup, linux]
excerpt: HackTheBox's first-ever box. Two paths to root through a vulnerable Samba username map script and a distccd RCE.
draft: true
---

## TL;DR

> TODO — 2-3 sentences: the vuln, the path you took, the key insight.

## Recon

### nmap

```bash
nmap -p- --min-rate 5000 -sV -sC -oA scans/initial 10.10.10.3
```

> TODO — paste relevant scan output. Open ports for Lame: 21 (vsftpd 2.3.4), 22 (OpenSSH), 139/445 (Samba 3.0.20), 3632 (distccd).

### What stands out

> TODO — note Samba 3.0.20 (CVE-2007-2447 territory) and distccd 1 (CVE-2004-2687).

## Shell as user

The Samba `username map script` vulnerability lets you inject shell commands into the username field during authentication.

```bash
# TODO — exploit invocation
```

## Shell as root

> TODO — explain why the Samba RCE already lands as root (smbd running as root), or alternate path via distccd → SUID binary.

## Beyond root

> TODO — note the second path (distccd CVE-2004-2687) and any other interesting findings.

## Lessons

- > TODO
- > TODO
