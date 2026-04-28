# solution.md — How to Run `create-php-starter` Locally Without the Paste Bug

## What actually broke

Multi-line shell commands with `\` line continuations were getting mangled by the terminal during paste. The shell ran `node` with no arguments, dropping into the Node REPL, and the rest of your pasted lines were interpreted as JavaScript — hence `Unexpected token '--'`, `Invalid regular expression flags`, and `--stack=full: command not found`.

`node /path/to/index.js --flag=value` is a perfectly valid invocation. The problem is **how the command reaches the shell**, not how Node parses it.

## The fix in three layers

Pick one based on how often you'll run it.

---

## Layer 1 — Saved runner script (fixes the paste bug today)

This is the only thing that *actually* solves the multi-line paste issue: write the command into a file once, then invoke the file. The shell reads the file as one continuous unit, so backslash continuations are honoured exactly.

Create `~/cps-test/run.sh`:

```bash
cat > ~/cps-test/run.sh <<'SCRIPT_EOF'
#!/usr/bin/env bash
# create-php-starter local runner
# Usage:
#   ./run.sh                           # default broad path
#   ./run.sh --db=mongodb              # override flags
#   PROJECT=foo ./run.sh               # override project name
#   CPS=/path/to/create-web-starter ./run.sh

set -euo pipefail

# ── Config (override via env vars) ───────────────────────────────────────────
CPS="${CPS:-/home/mrwayne/Documents/wayne/web_dev/create-web-starter}"
PROJECT="${PROJECT:-lara-inertia}"
WORKDIR="${WORKDIR:-$HOME/cps-test}"

# ── Sanity checks ────────────────────────────────────────────────────────────
[[ -f "$CPS/index.js" ]] || { echo "[!] index.js not found at $CPS"; exit 1; }
mkdir -p "$WORKDIR"
cd "$WORKDIR"

# ── Clean previous run ───────────────────────────────────────────────────────
if [[ -d "$PROJECT" ]]; then
  echo "[*] Removing previous $PROJECT/"
  rm -rf "$PROJECT"
fi

# ── Default flags (override by passing your own as arguments) ────────────────
DEFAULT_FLAGS=(
  --mode=laravel
  --stack=full
  --frontend=inertia
  --ts
  --auth=sanctum
  --db=mysql
  --testing
  --verbose
)

FLAGS=("$@")
if [[ ${#FLAGS[@]} -eq 0 ]]; then
  FLAGS=("${DEFAULT_FLAGS[@]}")
fi

echo "[*] Running: node $CPS/index.js $PROJECT ${FLAGS[*]}"
echo
node "$CPS/index.js" "$PROJECT" "${FLAGS[@]}"
SCRIPT_EOF

chmod +x ~/cps-test/run.sh
```

Now every test is a single, paste-safe command:

```bash
~/cps-test/run.sh                              # default broad path
~/cps-test/run.sh --mode=laravel --db=mongodb  # override flags
PROJECT=test2 ~/cps-test/run.sh                # different project name
```

The heredoc (`<<'SCRIPT_EOF'`) with quoted delimiter prevents the shell from doing any expansion when writing the file, so this whole block can itself be pasted into your terminal once.

---

## Layer 2 — `chmod +x` the entry point (saves typing `node`)

Your `index.js` already has `#!/usr/bin/env node` at the top, so you can run it directly:

```bash
chmod +x /home/mrwayne/Documents/wayne/web_dev/create-web-starter/index.js
```

Now `index.js` is executable. Inside `run.sh` (or any command), you can drop the `node` prefix:

```bash
"$CPS/index.js" "$PROJECT" "${FLAGS[@]}"
```

This is cosmetic — the script behaves the same. But it lets you do, by hand:

```bash
/home/mrwayne/.../index.js my-app --mode=laravel --db=mysql
```

without prefixing `node`.

---

## Layer 3 — `npm link` (best long-term dev workflow)

Symlink the package globally so you can call it from anywhere as if it were installed from npm:

```bash
cd /home/mrwayne/Documents/wayne/web_dev/create-web-starter
npm link
```

Now from any directory:

```bash
create-php-starter my-app --mode=laravel --stack=full --frontend=inertia --ts --auth=sanctum --db=mysql --testing --verbose
```

The symlink points at your repo, so every code edit is picked up immediately — no rebuild, no republish.

To verify or undo:

```bash
which create-php-starter                          # should point to ~/.nvm/.../bin/...
npm ls -g --depth=0 | grep create-php-starter     # confirms the link
npm unlink -g create-php-starter                  # remove it
```

> **Don't use `npx /path/to/index.js`** as GPT suggested. That form treats the path as a package spec and fails or does the wrong thing. `npx` is for *package names*, not file paths. Use `npm link` instead.

---

## Recommended stack for daily use

1. **Once** — `npm link` (Layer 3) so you have a global `create-php-starter` command.
2. **Once** — write `run.sh` (Layer 1) for repeatable scaffold tests with sane defaults.
3. **Each test** — `~/cps-test/run.sh` (or with overrides). Single-line, paste-safe, reproducible.

---

## Test matrix (drop into `run.sh` flags)

```bash
# Smoke tests — under 60s each on warm cache
~/cps-test/run.sh --mode=php --stack=vanilla --yes
~/cps-test/run.sh --mode=php --stack=mvc --yes
~/cps-test/run.sh --mode=laravel --stack=minimal --auth=none --db=sqlite

# Broad paths
~/cps-test/run.sh --mode=laravel --frontend=inertia --ts --auth=sanctum --db=mysql --testing
~/cps-test/run.sh --mode=laravel --frontend=react-vite --ts --testing
~/cps-test/run.sh --mode=laravel --db=mongodb --auth=sanctum

# Addons (run inside a generated project)
cd ~/cps-test/lara-inertia && create-php-starter add sanctum
cd ~/cps-test/lara-inertia && create-php-starter add pest
```

---

## If a paste *still* breaks

The only failure mode left is a corrupted clipboard or a terminal multiplexer eating bytes. Two fallbacks that always work:

```bash
# Pipe the command through bash explicitly
echo 'node /path/to/index.js my-app --mode=laravel --db=mysql' | bash

# Or use bash -c
bash -c 'node /path/to/index.js my-app --mode=laravel --db=mysql'
```

Both treat the entire string as one argv, ignoring your terminal's line-continuation handling completely.



cd my-app                                   
     cp .env.example .env                        
     php artisan key:generate                    
     php artisan migrate                         
   cd frontend && npm install && npm run dev   
     php artisan serve                           
# or: docker-compose up -d  