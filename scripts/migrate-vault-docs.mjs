/**
 * migrate-vault-docs.mjs
 *
 * One-time migration: imports Obsidian vault docs into TCM's Docs section.
 * Uses Supabase service role key — bypasses RLS, safe for one-time migration.
 *
 * Usage:
 *   node scripts/migrate-vault-docs.mjs
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY set in env (reads from .env.local if dotenv available)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://xjsrzkncndqonhhpozuw.supabase.co';

// Load env from .env.local or .env if not already set
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '..', envFile);
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, 'utf-8');
      const match = raw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
      if (match) { SERVICE_ROLE_KEY = match[1].trim(); break; }
    }
  }
}
if (!SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in env or .env.local');
  process.exit(1);
}

const VAULT_ROOT = '/Users/spencergreen/Desktop/FullStack Vault/FullStack';
const IMPORT_LIST = '/tmp/tcm_import_list.txt';
const CREATED_BY_EMAIL = 'clutch@joinfullstack.com';

// ─── Supabase client (service role — bypasses RLS) ───────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Folder mapping: vault relative dir → array of TCM folder name path ──────
// Order matters: more specific paths override parents.

const EXPLICIT_FOLDER_MAP = {
  '00-Inbox': ['Inbox'],
  '02-Projects': ['Projects'],
  '02-Projects/FullStackRX': ['Projects', 'FullStackRX'],
  '02-Projects/Invessio': ['Projects', 'Invessio'],
  '02-Projects/Mountain-View-Pharmacy': ['Projects', 'Mountain View Pharmacy'],
  '03-Agents': ['Agents'],
  '03-Agents/Control-Center': ['Agents', 'Control Center'],
  '03-Agents/TORQUE': ['Agents', 'Torque'],
  '05-TestForge': ['TestForge'],
  '05-TestForge/prd': ['TestForge', 'PRDs'],
  '06-Invessio-Org': ['Invessio Org'],
  '06-Invessio-Org/Meetings': ['Invessio Org', 'Meetings'],
  '07-Repositories': ['Repositories'],
  '07-Repositories/GitHub': ['Repositories', 'GitHub'],
  '07-Repositories/GitHub/TCM': ['Repositories', 'GitHub', 'TCM'],
  '07-Repositories/GitHub/TCM/Issues': ['Repositories', 'GitHub', 'TCM', 'Issues'],
  '07-Repositories/GitHub/fullthrottle': ['Repositories', 'GitHub', 'FullThrottle'],
  '07-Repositories/GitHub/fullthrottle/Issues': ['Repositories', 'GitHub', 'FullThrottle', 'Issues'],
  '07-Repositories/GitHub/mountainview': ['Repositories', 'GitHub', 'Mountain View'],
  '07-Repositories/GitHub/mountainview/Issues': ['Repositories', 'GitHub', 'Mountain View', 'Issues'],
  '07-Repositories/GitLab': ['Repositories', 'GitLab'],
  '07-Repositories/GitLab/fullstackrx-api': ['Repositories', 'GitLab', 'FullStackRX API'],
  '07-Repositories/GitLab/fullstackrx-api/Issues': ['Repositories', 'GitLab', 'FullStackRX API', 'Issues'],
  '07-Repositories/GitLab/fullstackrx-ui': ['Repositories', 'GitLab', 'FullStackRX UI'],
  '07-Repositories/GitLab/fullstackrx-ui/Issues': ['Repositories', 'GitLab', 'FullStackRX UI', 'Issues'],
  '07-Repositories/GitLab/invessio-lms-api': ['Repositories', 'GitLab', 'Invessio LMS API'],
  '07-Repositories/GitLab/invessio-lms-api/Issues': ['Repositories', 'GitLab', 'Invessio LMS API', 'Issues'],
  '07-Repositories/GitLab/invessio-lms-devops': ['Repositories', 'GitLab', 'Invessio LMS DevOps'],
  '07-Repositories/GitLab/invessio-lms-devops/Issues': ['Repositories', 'GitLab', 'Invessio LMS DevOps', 'Issues'],
  '07-Repositories/GitLab/invessio-lms-resources': ['Repositories', 'GitLab', 'Invessio LMS Resources'],
  '07-Repositories/GitLab/invessio-lms-resources/Issues': ['Repositories', 'GitLab', 'Invessio LMS Resources', 'Issues'],
  '07-Repositories/GitLab/invessio-lms-ui': ['Repositories', 'GitLab', 'Invessio LMS UI'],
  '07-Repositories/GitLab/invessio-lms-ui/Issues': ['Repositories', 'GitLab', 'Invessio LMS UI', 'Issues'],
  '07-Repositories/GitLab/invessio-marketplace-api': ['Repositories', 'GitLab', 'Invessio Marketplace API'],
  '07-Repositories/GitLab/invessio-marketplace-api/Issues': ['Repositories', 'GitLab', 'Invessio Marketplace API', 'Issues'],
  '07-Repositories/GitLab/invessio-marketplace-devops': ['Repositories', 'GitLab', 'Invessio Marketplace DevOps'],
  '07-Repositories/GitLab/invessio-marketplace-devops/Issues': ['Repositories', 'GitLab', 'Invessio Marketplace DevOps', 'Issues'],
  '07-Repositories/GitLab/invessio-marketplace-ui': ['Repositories', 'GitLab', 'Invessio Marketplace UI'],
  '07-Repositories/GitLab/invessio-marketplace-ui/Issues': ['Repositories', 'GitLab', 'Invessio Marketplace UI', 'Issues'],
  '99-System': ['System'],
  '99-System/Reports': ['System', 'Reports'],
  '99-System/Routing-Rules': ['System', 'Routing Rules'],
  '99-System/Templates': ['System', 'Templates'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const fm = {};
  let body = content;

  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const yaml = content.slice(3, end).trim();
      body = content.slice(end + 4).trimStart();

      for (const line of yaml.split('\n')) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        let val = line.slice(colon + 1).trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        fm[key] = val;
      }
    }
  }

  return { frontmatter: fm, body };
}

function humanizeFilename(filename) {
  return filename
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '') // strip leading date
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function getFolderPath(vaultRelFile) {
  // vaultRelFile = e.g. "02-Projects/FullStackRX/some-doc.md"
  const parts = vaultRelFile.split('/');
  if (parts.length === 1) return null; // root-level → no folder

  const dir = parts.slice(0, -1).join('/');
  if (EXPLICIT_FOLDER_MAP[dir]) return EXPLICIT_FOLDER_MAP[dir];

  // Fallback: humanize each component (strips leading NN- prefix)
  return dir.split('/').map((p) => {
    const stripped = p.replace(/^\d+-/, '');
    return stripped.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  });
}

function resolveProjectId(projectTag, projectsByPattern) {
  if (!projectTag) return null;
  const tag = projectTag.toLowerCase().trim();

  // Null tags
  if (['agents', 'process', 'all', 'team', 'general', 'engineering'].includes(tag)) return null;

  // Lookup
  if (tag.includes('fullstackrx') || tag === 'rx') {
    return projectsByPattern['fullstackrx'] ?? null;
  }
  if (tag.includes('invessio')) {
    return projectsByPattern['invessio'] ?? null;
  }
  if (tag.includes('testforge') || tag === 'tcm') {
    return projectsByPattern['testforge'] ?? null;
  }
  if (tag.includes('mountainview') || tag.includes('mountain-view')) {
    return projectsByPattern['mountainview'] ?? null;
  }

  return null;
}

// ─── Folder cache + creation ───────────────────────────────────────────────

// Map "Parent Name > Child Name" → folder_id
const folderCache = new Map();

async function ensureFolder(namePath, createdBy) {
  // namePath = ['Projects', 'FullStackRX']
  let parentId = null;

  for (let i = 0; i < namePath.length; i++) {
    const name = namePath[i];
    const cacheKey = namePath.slice(0, i + 1).join(' > ');

    if (folderCache.has(cacheKey)) {
      parentId = folderCache.get(cacheKey);
      continue;
    }

    // Check if folder already exists in DB
    let query = supabase
      .from('doc_folders')
      .select('id')
      .eq('name', name);

    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.is('parent_id', null);
    }

    const { data: existing, error: selectErr } = await query.maybeSingle();
    if (selectErr) throw new Error(`Folder lookup failed for "${name}": ${selectErr.message}`);

    if (existing) {
      folderCache.set(cacheKey, existing.id);
      parentId = existing.id;
    } else {
      // Create
      const { data: created, error: insertErr } = await supabase
        .from('doc_folders')
        .insert({ name, parent_id: parentId, created_by: createdBy, position: 0 })
        .select('id')
        .single();

      if (insertErr) throw new Error(`Folder create failed for "${name}": ${insertErr.message}`);
      folderCache.set(cacheKey, created.id);
      parentId = created.id;
    }
  }

  return parentId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TCM Vault Docs Migration ===\n');

  // 1. Resolve created_by user
  console.log(`Looking up user: ${CREATED_BY_EMAIL}`);
  let createdBy;
  try {
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 500 });
    if (usersErr) throw usersErr;
    const user = usersData?.users?.find((u) => u.email === CREATED_BY_EMAIL);
    if (user) {
      createdBy = user.id;
      console.log(`  → Found user: ${createdBy}`);
    }
  } catch (e) {
    console.warn(`  ⚠ Could not query auth.admin.listUsers: ${e.message}`);
  }

  if (!createdBy) {
    // Fall back to any admin user in profiles
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();
    if (adminProfile) {
      createdBy = adminProfile.id;
      console.log(`  → Fell back to admin profile: ${createdBy}`);
    } else {
      console.error('ERROR: Could not resolve created_by user ID. Aborting.');
      process.exit(1);
    }
  }

  // 2. Fetch projects for project_id mapping
  console.log('\nFetching projects...');
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name');
  if (projErr) {
    console.error(`ERROR fetching projects: ${projErr.message}`);
    process.exit(1);
  }
  console.log(`  → ${projects.length} projects found`);

  // Build pattern lookup
  const projectsByPattern = {};
  for (const p of projects) {
    const lower = p.name.toLowerCase();
    if (lower.includes('fullstackrx') || lower.includes('fullstack rx')) {
      projectsByPattern['fullstackrx'] = p.id;
    }
    if (lower.includes('invessio')) {
      projectsByPattern['invessio'] = p.id;
    }
    if (lower.includes('testforge') || lower.includes('test forge') || lower.includes('tcm')) {
      projectsByPattern['testforge'] = p.id;
    }
    if (lower.includes('mountain view') || lower.includes('mountainview')) {
      projectsByPattern['mountainview'] = p.id;
    }
  }
  console.log('  → Project map:', JSON.stringify(projectsByPattern, null, 2).replace(/\n/g, '\n    '));

  // 3. Read import file list
  const importList = fs.readFileSync(IMPORT_LIST, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  console.log(`\nFiles to import: ${importList.length}`);

  // 4. Pre-collect all unique folder paths and create them top-down
  console.log('\nCreating folders...');
  const uniqueFolderPaths = new Set();
  for (const relFile of importList) {
    const folderPath = getFolderPath(relFile);
    if (!folderPath) continue;
    // Add all ancestor paths too
    for (let i = 1; i <= folderPath.length; i++) {
      uniqueFolderPaths.add(folderPath.slice(0, i).join(' > '));
    }
  }

  // Sort by depth (shorter paths first) to ensure parent-before-child creation
  const sortedPaths = [...uniqueFolderPaths].sort((a, b) => {
    const depthA = a.split(' > ').length;
    const depthB = b.split(' > ').length;
    return depthA - depthB || a.localeCompare(b);
  });

  let foldersCreated = 0;
  for (const pathKey of sortedPaths) {
    const namePath = pathKey.split(' > ');
    const prevSize = folderCache.size;
    try {
      await ensureFolder(namePath, createdBy);
      if (folderCache.size > prevSize) foldersCreated++;
    } catch (e) {
      console.error(`  ✗ Folder error for "${pathKey}": ${e.message}`);
    }
  }
  console.log(`  → Folders created: ${foldersCreated} (${folderCache.size} total in cache)`);

  // 5. Import docs
  console.log('\nImporting docs...');
  let docsImported = 0;
  let docsSkipped = 0;
  const errors = [];

  for (const relFile of importList) {
    const absPath = path.join(VAULT_ROOT, relFile);

    // Read file
    let rawContent;
    try {
      rawContent = fs.readFileSync(absPath, 'utf-8');
    } catch (e) {
      errors.push(`Read error for "${relFile}": ${e.message}`);
      continue;
    }

    // Parse frontmatter
    const { frontmatter, body } = parseFrontmatter(rawContent);

    // Determine title
    const filename = path.basename(relFile);
    const title = frontmatter.title || humanizeFilename(filename);

    // Resolve folder_id
    const folderPath = getFolderPath(relFile);
    let folderId = null;
    if (folderPath) {
      try {
        folderId = await ensureFolder(folderPath, createdBy);
      } catch (e) {
        errors.push(`Folder resolve error for "${relFile}": ${e.message}`);
        continue;
      }
    }

    // Resolve project_id
    const projectTag = frontmatter.project || null;
    const projectId = resolveProjectId(projectTag, projectsByPattern);

    // Check for duplicate (same title in same folder)
    let dupeQuery = supabase
      .from('docs')
      .select('id')
      .eq('title', title);

    if (folderId) {
      dupeQuery = dupeQuery.eq('folder_id', folderId);
    } else {
      dupeQuery = dupeQuery.is('folder_id', null);
    }

    const { data: existing, error: dupeErr } = await dupeQuery.maybeSingle();
    if (dupeErr) {
      errors.push(`Dupe check error for "${relFile}": ${dupeErr.message}`);
      continue;
    }
    if (existing) {
      console.log(`  ⊘ Skip (duplicate): ${title}`);
      docsSkipped++;
      continue;
    }

    // Insert
    const { error: insertErr } = await supabase.from('docs').insert({
      title,
      content: body,
      folder_id: folderId,
      project_id: projectId,
      created_by: createdBy,
    });

    if (insertErr) {
      errors.push(`Insert error for "${relFile}": ${insertErr.message}`);
      continue;
    }

    console.log(`  ✓ ${title}`);
    docsImported++;
  }

  // 6. Final report
  console.log('\n════════════════════════════════════════');
  console.log('Migration Complete');
  console.log('════════════════════════════════════════');
  console.log(`  Folders created:         ${foldersCreated}`);
  console.log(`  Docs imported:           ${docsImported}`);
  console.log(`  Docs skipped (duplicate): ${docsSkipped}`);
  console.log(`  Errors:                  ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nError details:');
    errors.forEach((e) => console.log(`  ✗ ${e}`));
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
