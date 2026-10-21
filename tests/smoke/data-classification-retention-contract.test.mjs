import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const inventory = readFileSync(new URL("docs/security/data-classification-retention-v1.md", root), "utf8");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The nine inventoried data classes, spelled exactly as their `### ` headings.
// The last class heading is "Synthetic fixtures and test evidence"; a prefix
// match would silently let the section absorb the trailing document chapters.
const requiredClasses = [
  "User identity and authentication",
  "Portfolio and account metadata",
  "Canonical ledger activity",
  "Raw provider payloads and imports",
  "Reports and exports",
  "Credentials and secret references",
  "Audit records",
  "Logs and traces",
  "Synthetic fixtures and test evidence"
];

// Classes that hold user- or account-linked runtime data. These own a
// deletion/revocation boundary on restore. The synthetic-fixture class holds no
// such data and instead owns the "no credentials or personal data in backups"
// boundary (see perClassGuarantees).
const runtimeDataClasses = new Set([
  "User identity and authentication",
  "Portfolio and account metadata",
  "Canonical ledger activity",
  "Raw provider payloads and imports",
  "Reports and exports",
  "Credentials and secret references",
  "Audit records",
  "Logs and traces"
]);

const requiredFields = [
  "Classification",
  "Representative fields",
  "Authorized access",
  "Masking / redaction",
  "Audit requirement",
  "Retention / deletion owner",
  "Backup / restore treatment"
];

// Boundary ownership map. Each class owns the guarantees it documents, so a
// boundary removed from one class cannot be satisfied by a sibling class or by
// the vocabulary/lifecycle prose elsewhere in the document.
//
//   access  -> "Authorized access"
//   masking -> "Masking / redaction"
//   audit   -> "Audit requirement"
//   owner   -> "Retention / deletion owner"
//   restore -> "Backup / restore treatment"
//
// Ownership decisions recorded here (documentation decisions, not weakened
// assertions): the canonical ledger class owns the no-physical-deletion and
// restore-reapply guarantees; raw payloads own restore-time deletion replay;
// reports/exports own artifact expiry re-application; credentials own
// revocation/credential resurrection; the identity class owns session/factor
// re-activation; the audit-records class owns the legal-hold/boundary note; the
// vocabulary chapter owns the blanket server-side authorization requirement.
const perClassGuarantees = {
  "User identity and authentication": {
    access: [/narrowly scoped auth workers/i, /only for an approved incident\/purpose/i, /never use an email or client-supplied user id as proof of identity/i],
    masking: [/omit email and auth metadata by default in logs\/traces/i, /hash opaque session\/state\/code values/i, /encrypt totp secret material/i],
    audit: [/`trace_id`/, /`correlation_id`/, /audit payloads contain no raw credentials or codes/i],
    owner: [/identity & access owner owns account lifecycle/i, /soft-delete\/revoke lifecycle/i, /revoke sessions\/factors\/grants/i],
    restore: [/protected encrypted backups/i, /restore must preserve revoked\/deleted state/i, /must not reactivate sessions, factors, or grants/i]
  },
  "Portfolio and account metadata": {
    access: [/permissions enforced by server-side role and portfolio\/account scope at every read\/write boundary/i, /cross-portfolio and outsider access is denied/i],
    masking: [/do not log account names, external ids, iban fragments/i, /sanitize provider error messages/i],
    audit: [/actor\/entity\/trace\/correlation/i, /do not copy complete before\/after secret or provider payload values into audit/i],
    owner: [/portfolio owner owns portfolio\/account configuration/i, /archive\/revoke on user deletion or disconnect/i, /no period is currently approved/i],
    restore: [/restore must preserve membership revocations/i, /keep revoked references revoked/i, /do not restore credentials from ordinary db backup/i]
  },
  "Canonical ledger activity": {
    access: [/server-authorized portfolio\/account members/i, /only ledger application commands can create\/correct\/void canonical activity/i, /never rely on ui controls/i],
    masking: [/do not put activity descriptions, amounts, identifiers, or provider payload content in routine logs\/traces/i, /avoid full ledger rows in errors/i],
    audit: [/prohibit physical deletion of ledger activity/i, /retain original activities and entries as audit history/i, /trace\/correlation/i],
    owner: [/ledger owner owns canonical transaction\/entry and correction lifecycle/i, /no physical deletion of ledger history/i, /soft-delete must not cascade-delete canonical activity/i],
    restore: [/restore must retain void\/correction\/audit linkage/i, /a restore must reapply deletion\/revocation state before serving traffic/i, /does not itself authorize purging ledger rows from a backup/i]
  },
  "Raw provider payloads and imports": {
    access: [/object-storage reads require server-side ownership\/scope checks/i, /raw evidence is not a ledger-write capability/i],
    masking: [/never log or trace raw bodies, file contents, rows, access tokens/i, /use synthetic data only/i],
    audit: [/audit records refer to payload ids\/checksums, not content/i, /trace\/correlation/i],
    owner: [/integrations owner owns raw provider payload lifecycle/i, /no approved default or period/i, /must not silently delete canonical ledger history/i],
    restore: [/backed up encrypted with integrity checks and matched references/i, /restore-time deletion replay/i, /not an erasure guarantee/i]
  },
  "Reports and exports": {
    access: [/may export only self-owned\/authorized scope/i, /re-check ownership\/role and expiry on every status\/download request/i, /do not provide a public object url/i],
    masking: [/do not log report contents, filters that may contain pii/i, /export must exclude password\/secret material/i],
    audit: [/without embedding the artifact contents/i, /trace\/correlation/i],
    owner: [/reports owner owns report artifact lifecycle/i, /is a schema field, not an approved duration/i, /generating it does not itself delete source records/i],
    restore: [/reapply artifact expiry\/deletion and sharing revocations before access/i, /protect with encryption\/checksum/i]
  },
  "Credentials and secret references": {
    access: [/only the secret-management boundary and the specific service identity authorized/i, /revocation\/rotation must be effective server-side/i, /never put secret values in git/i],
    masking: [/never render or log raw values/i, /redact secret\/token\/password\/code\/private-key patterns/i],
    audit: [/never log value, hash intended as bearer material, ciphertext, nonce or recovery code/i, /trace\/correlation/i],
    owner: [/security\/secrets owner owns vault policy and access review/i, /exact secret version retention and destruction schedule is not decided/i],
    restore: [/do not put plaintext secrets in db backups/i, /must not undo revocation or resurrect obsolete credentials/i, /recovery of keys\/vault material is a separately authorized and tested process/i]
  },
  "Audit records": {
    access: [/audit service writes through the controlled application boundary/i, /least privilege/i, /no direct database broad access is implied/i],
    masking: [/omit raw tokens, full ip addresses, secrets, financial values/i, /ip hash remains sensitive/i],
    audit: [/`trace_id` and `correlation_id`/, /access-denial and export\/delete events must retain safe evidence/i],
    owner: [/security owns audit policy/i, /no retention duration or immutability\/worm guarantee is approved here/i, /legal requirements are unresolved/i],
    restore: [/restore preserves event order\/context and deletion\/retention state/i, /any legal hold must be separately applied/i, /no claim of tamper-proof audit storage/i]
  },
  "Logs and traces": {
    access: [/scoped observability services/i, /restrict query\/export by environment, service and role/i, /do not propagate authorization headers/i],
    masking: [/allowlist safe fields/i, /redact tokens\/secrets\/api keys/i, /use synthetic test sentinels to verify absence/i],
    audit: [/application events preserve trace\/correlation linkage/i],
    owner: [/operations owns log\/trace storage and purge controls/i, /no log\/trace retention period is approved in the reviewed contract/i],
    restore: [/not canonical ledger recovery inputs/i, /restore must honor configured expiration and deletion/i, /no retention or deletion behavior is claimed/i]
  },
  "Synthetic fixtures and test evidence": {
    access: [/repository contributors and ci identities with repository access/i, /no real provider\/bank\/model credentials/i],
    masking: [/synthetic-only/i, /never echo credentials\/codes in failing assertions or snapshots/i],
    audit: [/never use fixture values as production credentials/i, /attach trace\/correlation context to test commands/i],
    owner: [/remove accidental sensitive data immediately through the incident\/secrets process/i, /the normal fixture policy does not justify retaining actual pii/i],
    restore: [/verify no credentials or real personal data enter those backups/i, /must not be mistaken for production privacy\/compliance evidence/i]
  }
};

// The four classification levels the inventory's own vocabulary defines, in the
// order the vocabulary chapter lists them. Every pinned level below must come
// from this vocabulary: a class may not be pinned to a level the document does
// not define.
const vocabularyLevels = ["Restricted", "Confidential", "Internal", "Public"];

// Escalation markers: the words that introduce an obligation in a
// classification statement. Every marker the document states must be covered
// by a pinned escalation fragment, so the pin map cannot be weakened by
// emptying a class's escalation list while the document still states the
// obligation. Without this, dropping "increase to Restricted ..." from the
// map would leave the document's escalation unchecked and the contract green.
const escalationMarkers = /\b(?:promote|increase|escalate|raise|whenever|unless|except)\b/gi;

// The classification level each class is pinned to.
//
// A class's classification label is the control that decides who may read the
// data and which masking rules apply. Asserting only that *a* level is present
// leaves that control unguarded: a class could be re-labelled from Restricted
// to Public or Internal and every other assertion in this contract would still
// hold. This map pins, per class:
//
//   base       the class's default classification - the level it carries
//              before any escalation clause applies.
//   levels     every level word the classification statement may use, in
//              order. The base level is always first.
//   escalation the escalation obligation and the condition that triggers it,
//              as literal fragments of the statement. An empty list means the
//              class states no escalation.
//   qualifier  the parenthetical the statement may carry. A qualifier is
//              where a downgrade hides behind an unchanged level word
//              ("Restricted (open access)"), so it is a reviewed value too.
//              An empty string means the statement may carry none.
//   statement  the complete expected classification statement, verbatim.
//              The level word alone is not the whole control: the sentence
//              around it states the class's scope ("may reveal user
//              identity, financial entities, access patterns or incident
//              details"), and narrowing that scope while keeping the level
//              word is a downgrade too. Pinning the full statement makes any
//              narrowing, rewording or trailing edit a deliberate, reviewable
//              change to this contract.
//
// These are hard pins, not a table derived from the document: the levels and
// the statements are reviewed values, so changing one is a deliberate,
// reviewable edit to this contract rather than a silent edit of the
// inventory.
//
// The map is itself a contract: every inventoried class must appear in it
// exactly once, so a class cannot silently lose its pin.
const expectedClassification = {
  "User identity and authentication": {
    base: "Restricted",
    levels: ["Restricted"],
    escalation: [],
    qualifier: "",
    statement: "Restricted."
  },
  "Portfolio and account metadata": {
    base: "Confidential",
    levels: ["Confidential", "Restricted"],
    escalation: ["increase to Restricted where metadata includes provider identifiers, account hints, or sensitive free text"],
    qualifier: "",
    statement: "Confidential; increase to Restricted where metadata includes provider identifiers, account hints, or sensitive free text."
  },
  "Canonical ledger activity": {
    base: "Restricted",
    levels: ["Restricted"],
    escalation: [],
    qualifier: "financial activity and account-linked positions/balances",
    statement: "Restricted (financial activity and account-linked positions/balances)."
  },
  "Raw provider payloads and imports": {
    base: "Restricted",
    levels: ["Restricted"],
    escalation: [],
    qualifier: "",
    statement: "Restricted. Treat raw payload, uploaded statements, webhook bodies, CSV/XLSX/PDF, raw rows, normalized/resolved rows, and provider identifiers as potentially containing full account and transaction data."
  },
  "Reports and exports": {
    base: "Restricted",
    levels: ["Restricted"],
    escalation: [],
    qualifier: "",
    statement: "Restricted when user/portfolio-derived; a report artifact is a portable copy of its included source data."
  },
  "Credentials and secret references": {
    base: "Restricted",
    levels: ["Restricted"],
    escalation: [],
    qualifier: "highest sensitivity class in this inventory",
    statement: "Restricted (highest sensitivity class in this inventory)."
  },
  "Audit records": {
    base: "Restricted",
    levels: ["Restricted"],
    escalation: [],
    qualifier: "",
    statement: "Restricted security/accountability metadata; may reveal user identity, financial entities, access patterns or incident details."
  },
  "Logs and traces": {
    base: "Internal",
    levels: ["Internal", "Restricted"],
    escalation: ["Restricted whenever a trace/log includes user/account/provider identifiers, authentication metadata, IP hash, exception payload, or financial context"],
    qualifier: "",
    statement: "Internal by default; Restricted whenever a trace/log includes user/account/provider identifiers, authentication metadata, IP hash, exception payload, or financial context."
  },
  "Synthetic fixtures and test evidence": {
    base: "Internal",
    levels: ["Internal"],
    escalation: ["promote classification if any fixture contains real or plausibly identifying data"],
    qualifier: "",
    statement: "Internal, explicitly synthetic and non-identifying; promote classification if any fixture contains real or plausibly identifying data."
  }
};

const guaranteeFields = {
  access: "Authorized access",
  masking: "Masking / redaction",
  audit: "Audit requirement",
  owner: "Retention / deletion owner",
  restore: "Backup / restore treatment"
};

// Duration-like tokens (days/weeks/months/years, incl. Dutch variants) are
// never a documented control in this inventory: the only permitted mention is
// the explicitly disclaimed local `30-day` backup value inside NOT DECIDED.
const durationPattern = /\b\d+\s*(?:-|–)?\s*(?:days?|weeks?|months?|years?|hours?|dagen?|weken?|maanden?|jaren?|uren?)\b/i;

// Claim shapes that would over-claim runtime enforcement, compliance, legal
// hold or erasure. The inventory may only ever disclaim these.
const forbiddenClaims = [
  [/\ball in place\b/i, "inventory must not claim controls are all in place"],
  [/\bin place and verified\b/i, "inventory must not claim verified production controls"],
  [/\b(?:row-level security|\bRLS\b)[^.\n]{0,120}\b(?:in place|enforced|enabled|implemented|verified|active)\b/i, "inventory must not claim row-level security or RLS"],
  [/\bautomated purge\b[^.\n]{0,40}\b(?:is|are)\s+(?:in place|enabled|implemented|active)\b/i, "inventory must not claim automated purge"],
  [/\b(?:full )?regulatory compliance\b[^.\n]{0,40}\b(?:is|are)\s+(?:in place|achieved|met|satisfied|verified)\b/i, "inventory must not claim regulatory compliance"],
  [/\bcompliant\b/i, "inventory must not claim compliance"],
  [/\blegal[ -]hold\s+(?:is|are)\s+(?:supported|implemented|enforced|available)\b/i, "inventory must not claim legal hold is supported"],
  [/\b(?:implements?|enforces?)\s+legal[ -]hold\b/i, "inventory must not claim an implemented legal-hold mechanism"],
  [/\blegal[ -]hold\b[^.\n]{0,40}\bin place\b/i, "inventory must not claim legal hold is in place"],
  [/\b(?:delet(?:ion|ed)|purg(?:e|ing))[^.\n]{0,60}\b(?:is|are)\s+(?:permitted|allowed|authorized)\b/i, "inventory must not permit deletion of ledger activity"],
  [/\b(?:permitted|allowed|authorized)[^.\n]{0,30}\b(?:physical(?:ly)? )?delet(?:ion|ed)\b/i, "inventory must not permit physical deletion"],
  [/\brestore[^.\n]{0,40}\bnever\b[^.\n]{0,20}\breintroduc/i, "inventory must not promise that restore never reintroduces deleted material"],
  [/\bnever reintroduces?\b/i, "inventory must not promise that restore never reintroduces deleted material"]
];

function classSection(dataClass) {
  const heading = new RegExp(`^### ${escapeRegExp(dataClass)}$`, "m");
  const match = heading.exec(inventory);
  assert.ok(match, `missing data class heading: ${dataClass}`);
  const after = inventory.slice(match.index + match[0].length);
  const nextHeading = /^(?:##|###)\s/m.exec(after);
  return nextHeading ? after.slice(0, nextHeading.index) : after;
}

function chapterSection(headingPattern, label) {
  const match = headingPattern.exec(inventory);
  assert.ok(match, `missing section: ${label}`);
  const after = inventory.slice(match.index + match[0].length);
  const nextHeading = /^(?:##|###)\s/m.exec(after);
  return nextHeading ? after.slice(0, nextHeading.index) : after;
}

function fieldValue(section, field, dataClass) {
  const pattern = new RegExp(`^- ${escapeRegExp(field)}:[ \\t]*(.+)$`, "im");
  const match = pattern.exec(section);
  assert.ok(match, `${dataClass} missing inventory field: ${field}`);
  return match[1].trim();
}

// `trace_id` and `correlation_id` are the canonical identifiers; several classes
// spell the pair as "trace/correlation" instead. Both forms count as linkage.
const traceLinkage = /\btrace_id\b|\btrace\/correlation\b/i;
const correlationLinkage = /\bcorrelation_id\b|\btrace\/correlation\b/i;

function distinctWords(value) {
  return new Set(value.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []);
}

test("TC-US-0003-A: every inventoried class states seven substantive, non-placeholder controls", () => {
  const headings = [...inventory.matchAll(/^###\s+(.*)$/gm)].map((match) => match[1].trim());
  assert.deepEqual(headings, requiredClasses, "the `### ` class headings must match the inventoried classes exactly");

  for (const dataClass of requiredClasses) {
    const section = classSection(dataClass);
    const values = new Set();
    for (const field of requiredFields) {
      const pattern = new RegExp(`^- ${escapeRegExp(field)}:[ \\t]*(.+)$`, "img");
      const matches = [...section.matchAll(pattern)];
      assert.equal(matches.length, 1, `${dataClass} must state ${field} exactly once`);
      const value = matches[0][1].trim();
      assert.ok(value.length > 0, `${dataClass} has an empty ${field}`);
      assert.doesNotMatch(value, /^(?:tbd|todo|placeholder|n\/a|not decided|xxx+)\.?$/i, `${dataClass} has placeholder ${field}`);
      assert.doesNotMatch(value, /^\W+$/, `${dataClass} has filler ${field}`);
      values.add(value);
      if (field === "Classification") {
        assert.match(value, /^(?:Restricted|Confidential|Internal|Public)\b/i, `${dataClass} needs an explicit classification label`);
      } else {
        assert.ok(value.length >= 60, `${dataClass} has an insubstantial ${field}: ${value}`);
        assert.ok(distinctWords(value).size >= 12, `${dataClass} has filler ${field}: ${value}`);
      }
    }
    assert.equal(values.size, requiredFields.length, `${dataClass} repeats the same text across control fields`);
  }
});

test("TC-US-0003-A: each class carries the access, masking, audit, owner and restore guarantees it owns", () => {
  for (const [dataClass, guarantees] of Object.entries(perClassGuarantees)) {
    const section = classSection(dataClass);
    for (const [dimension, patterns] of Object.entries(guarantees)) {
      const field = guaranteeFields[dimension];
      const value = fieldValue(section, field, dataClass);
      for (const pattern of patterns) {
        assert.match(value, pattern, `${dataClass} ${field} lost a required guarantee: ${pattern}`);
      }
    }
  }
});

test("TC-US-0003-A: the classification level of every class is pinned to its expected level", () => {
  // The pin map holds hard-coded reviewed values, so the alphabet it draws
  // from is anchored in the inventory's own vocabulary chapter: exactly four
  // levels, spelled exactly as pinned, in that order. A fifth level, a
  // renamed level or a reordered vocabulary must fail here instead of
  // silently widening what the contract accepts.
  //
  // The chapter is read generically - every bullet in it must be a level
  // definition - so that adding a fifth level is caught as well as renaming
  // or reordering an existing one.
  const vocabulary = chapterSection(/^## Classification and handling vocabulary$/m, "Classification and handling vocabulary");
  const vocabularyBullets = vocabulary.split("\n").filter((line) => line.startsWith("- "));
  const definedLevels = vocabularyBullets.map((bullet) => {
    const match = /^- ([A-Za-z][A-Za-z ]*):/.exec(bullet);
    assert.ok(match, `the vocabulary chapter must only define classification levels, found: ${bullet}`);
    return match[1].trim();
  });
  assert.deepEqual(definedLevels, vocabularyLevels, "the vocabulary chapter must define exactly the four pinned levels, in order");

  // The pin map must cover every inventoried class exactly once. Without this,
  // deleting a class from the map would silently unpin it: the loop below
  // only visits the classes the map still lists, so a removed class would no
  // longer be checked at all and the contract would stay green.
  assert.deepEqual(
    Object.keys(expectedClassification),
    requiredClasses,
    "the classification pin map must cover every inventoried class exactly once, in inventory order"
  );

  // Every pinned level must be a level the vocabulary actually defines, and
  // the base level must be the first level the class may carry.
  for (const [dataClass, expected] of Object.entries(expectedClassification)) {
    assert.ok(
      vocabularyLevels.includes(expected.base),
      `${dataClass} is pinned to "${expected.base}", which the vocabulary does not define`
    );
    for (const level of expected.levels) {
      assert.ok(
        vocabularyLevels.includes(level),
        `${dataClass} is pinned to the level "${level}", which the vocabulary does not define`
      );
    }
    assert.equal(
      expected.levels[0],
      expected.base,
      `${dataClass} is pinned to a base level that is not the first of its levels`
    );
  }

  for (const [dataClass, expected] of Object.entries(expectedClassification)) {
    const section = classSection(dataClass);
    const value = fieldValue(section, "Classification", dataClass);

    // Every level word the statement uses, in order of appearance. Matched
    // case-insensitively so a lower-cased level is still seen, then compared
    // strictly so the spelling has to match the vocabulary's own spelling.
    const statedLevels = [...value.matchAll(/\b(Restricted|Confidential|Internal|Public)\b/gi)].map((match) => match[0]);

    assert.ok(statedLevels.length > 0, `${dataClass} states no classification level: ${value}`);
    assert.equal(statedLevels[0], expected.base, `${dataClass} classification level changed: expected ${expected.base}, got "${value}"`);
    assert.deepEqual(statedLevels, expected.levels, `${dataClass} classification levels changed: expected ${expected.levels.join(" -> ")}, got "${value}"`);
    assert.ok(value.startsWith(expected.base), `${dataClass} classification statement must start with its pinned level ${expected.base}: ${value}`);

    // A parenthetical qualifier is where a downgrade hides behind an
    // unchanged level word: "Restricted (open access)" keeps the level word
    // but lowers the control. The qualifier is pinned, so it must be the
    // reviewed one - and a class with no pinned qualifier may carry none.
    const qualifiers = [...value.matchAll(/\(([^()]*)\)/g)].map((match) => match[1].trim());
    if (expected.qualifier) {
      assert.deepEqual(qualifiers, [expected.qualifier], `${dataClass} classification qualifier changed: expected "${expected.qualifier}", got "${value}"`);
    } else {
      assert.deepEqual(qualifiers, [], `${dataClass} must not carry a classification qualifier, got "${value}"`);
    }

    // A class may escalate but never de-escalate. The escalation obligation
    // and the condition that triggers it are pinned separately, so dropping
    // the clause, downgrading its target level or weakening its condition
    // each fail on their own.
    for (const fragment of expected.escalation) {
      assert.match(value, new RegExp(escapeRegExp(fragment), "i"), `${dataClass} lost its required classification escalation: "${fragment}"`);
    }

    // Every escalation the statement expresses must be covered by a pinned
    // fragment. Without this, the pin map could be edited to drop a class's
    // escalation entirely and the document's obligation would go unchecked.
    const statedEscalations = [...value.matchAll(escalationMarkers)].map((match) => match[0].toLowerCase());
    for (const marker of statedEscalations) {
      const covered = expected.escalation.some((fragment) =>
        new RegExp(escapeRegExp(marker), "i").test(fragment)
      );
      assert.ok(covered, `${dataClass} states an escalation ("${marker}") that no pinned classification escalation covers`);
    }

    // Finally the whole statement, verbatim. The level word is only part of
    // the control: the sentence around it states the class's scope, and
    // narrowing that scope while keeping the level word is a downgrade too.
    // Compared after collapsing whitespace so a reflow of the markdown is not
    // a failure, but any change of wording is.
    const normalize = (text) => text.replace(/\s+/g, " ").trim();
    assert.equal(
      normalize(value),
      normalize(expected.statement),
      `${dataClass} classification statement changed: expected "${expected.statement}", got "${value}"`
    );
  }
});

test("TC-US-0003-A: authorization, redaction, auditability, ownership and restore are stated per class", () => {
  for (const dataClass of requiredClasses) {
    const section = classSection(dataClass);
    const access = fieldValue(section, "Authorized access", dataClass);
    const masking = fieldValue(section, "Masking / redaction", dataClass);
    const audit = fieldValue(section, "Audit requirement", dataClass);
    const owner = fieldValue(section, "Retention / deletion owner", dataClass);
    const restore = fieldValue(section, "Backup / restore treatment", dataClass);

    assert.match(access, /(?:server-side|server-authoriz|scope|scoped|least[- ]privilege|denied|restricted|must not|never|only)\b/i, `${dataClass} states no access-control rule`);
    assert.match(masking, /(?:mask\w*|redact\w*|omit\w*|exclud\w*|sanitiz\w*|scrub\w*|allowlist|do not log|never log|never render|never echo|synthetic-only|without)\b/i, `${dataClass} states no masking/redaction rule`);
    assert.match(audit, traceLinkage, `${dataClass} audit requirement omits trace linkage`);
    assert.match(audit, correlationLinkage, `${dataClass} audit requirement omits correlation linkage`);
    assert.match(owner, /\b(?:owner|owns|steward)\b/i, `${dataClass} names no lifecycle owner`);
    assert.match(restore, /(?:restore\w*|backup\w*)\b/i, `${dataClass} states no backup/restore treatment`);

    // Recorded documentation decision: only the classes that hold user- or
    // account-linked runtime data own a deletion/revocation boundary on
    // restore. The synthetic-fixture class holds no such data, so it owns the
    // "no credentials or personal data in backups" boundary instead, which is
    // asserted explicitly for it in the per-class guarantee table above.
    if (runtimeDataClasses.has(dataClass)) {
      assert.match(restore, /(?:delet|revoc|reappl|preserv|expir|purge|reactivat|resurrect|reintroduc|undo|encrypt)/i, `${dataClass} states no deletion/revocation boundary on restore`);
    }
  }
});

test("TC-US-0003-B: lifecycle, legal-hold, no-jurisdiction and NOT DECIDED boundaries stay explicit", () => {
  const vocabulary = chapterSection(/^## Classification and handling vocabulary$/m, "Classification and handling vocabulary");
  assert.match(vocabulary, /authorized server-side at each application boundary/i, "vocabulary must require server-side authorization");
  assert.match(vocabulary, /checked server-side on every request\/job/i, "vocabulary must require server-side checks on every request/job");
  assert.match(vocabulary, /not proof that database row-level security exists/i, "vocabulary must not claim row-level security");
  assert.match(vocabulary, /a ui-hidden field is not an access control/i, "vocabulary must not treat UI hiding as authorization");
  assert.match(vocabulary, /grants are least-privilege and revocable/i, "vocabulary must require least-privilege grants");
  assert.match(vocabulary, /provider adapters and ai\/addons do not get direct ledger writes/i, "vocabulary must keep the ADR-0002 write boundary");
  assert.match(vocabulary, /user-linked records do not become public/i, "vocabulary must not turn user-linked records into public data");

  const lifecycle = chapterSection(/^## Lifecycle boundaries and evidence limits$/m, "Lifecycle boundaries and evidence limits");
  assert.match(lifecycle, /user deletion currently means application-level soft delete and revocation/i, "lifecycle must document the soft-delete boundary");
  assert.match(lifecycle, /canonical ledger history is not physically deleted/i, "lifecycle must document no physical ledger deletion");
  assert.match(lifecycle, /restore can reintroduce deleted\/revoked material unless the restore procedure reapplies a deletion\/revocation ledger/i, "lifecycle must document the restore resurrection risk");
  assert.match(lifecycle, /no evidenced legal-hold mechanism/i, "lifecycle must disclaim an implemented legal-hold mechanism");
  assert.match(lifecycle, /proposed boundary, not an implemented capability/i, "lifecycle must mark legal hold as proposed only");
  assert.match(lifecycle, /no class is assigned a jurisdiction-specific period/i, "lifecycle must refuse jurisdiction-specific periods");
  assert.match(lifecycle, /is not approval of a data-class, legal, or production retention period/i, "lifecycle must disclaim the local 30-day value as approval");
  assert.match(lifecycle, /does not establish production rls/i, "lifecycle must disclaim production RLS");
  assert.match(lifecycle, /does not establish/i, "lifecycle must carry an explicit evidence-limits statement");

  const notDecided = chapterSection(/^## NOT DECIDED\b.*$/m, "NOT DECIDED");
  const decisions = [...notDecided.matchAll(/^\d+\.\s+(.+)$/gm)].map((match) => match[1].trim());
  assert.equal(decisions.length, 7, "NOT DECIDED must enumerate every owner/legal decision");
  for (const [index, decision] of decisions.entries()) {
    assert.ok(decision.length >= 150, `NOT DECIDED decision ${index + 1} is insubstantial: ${decision}`);
    assert.match(decision, /owner|counsel|operations|security/i, `NOT DECIDED decision ${index + 1} names no responsible party`);
  }
  assert.match(notDecided, /applicable jurisdictions/i, "NOT DECIDED must record the open jurisdiction decision");
  assert.match(notDecided, /explicit retention trigger, duration, deletion\/anonymization method/i, "NOT DECIDED must record the open per-class retention decision");
  assert.match(notDecided, /define backup schedule\/expiry/i, "NOT DECIDED must record the open backup decision");
  assert.match(notDecided, /approve legal-hold authority, scope/i, "NOT DECIDED must record the open legal-hold decision");
  assert.match(notDecided, /approve vault\/kms/i, "NOT DECIDED must record the open vault decision");
  assert.match(notDecided, /no assumption made here/i, "NOT DECIDED must not assume the local 30-day value has a production analogue");
  const durations = [...notDecided.matchAll(new RegExp(durationPattern.source, "gi"))];
  assert.equal(durations.length, 1, "NOT DECIDED may only reference the disclaimed local 30-day value");
  assert.match(durations[0]?.[0] ?? "", /30/i, "the only permitted duration mention is the disclaimed local 30-day value");

  const traceability = chapterSection(/^## Traceability and gate status$/m, "Traceability and gate status");
  assert.match(traceability, /^- TC-US-0003-A:.*$/m, "traceability must name TC-US-0003-A");
  assert.match(traceability, /^- TC-US-0003-B:.*$/m, "traceability must name TC-US-0003-B");
  assert.match(traceability, /^- TC-US-0003-A:.*classification, authorized access, masking\/redaction, and audit requirements/im, "the TC-US-0003-A line must list the labelled dimensions");
  assert.match(traceability, /^- TC-US-0003-B:.*lifecycle owner.*backup\/restore.*soft-delete/im, "the TC-US-0003-B line must list owner, backup/restore and soft-delete");
  assert.match(traceability, /^- Tests: `tests\/smoke\/data-classification-retention-contract\.test\.mjs`/m, "traceability must point at the contract test");
});

test("TC-US-0003-B: the inventory asserts no unsupported retention, compliance or implemented-control claims", () => {
  for (const dataClass of requiredClasses) {
    const section = classSection(dataClass);
    assert.doesNotMatch(section, durationPattern, `${dataClass} must not assert a retention duration`);
  }

  for (const [pattern, reason] of forbiddenClaims) {
    assert.doesNotMatch(inventory, pattern, reason);
  }

  // The disclaimed local backup value may only appear as environment evidence.
  const localValueMentions = [...inventory.matchAll(/retention_days:\s*30/g)];
  assert.equal(localValueMentions.length, 1, "the local retention_days: 30 evidence may be referenced once");
  assert.match(inventory, /`retention_days: 30`; that is environment-specific implementation evidence only/i);
});

test("TC-US-0003: the inventory stays traceable without transient identifiers or truncation artefacts", () => {
  assert.match(inventory, /TC-US-0003-A/);
  assert.match(inventory, /TC-US-0003-B/);
  assert.match(inventory, /ADR-0001/);
  assert.match(inventory, /ADR-0002/);
  assert.match(inventory, /W0-1/);
  assert.match(inventory, /NOT DECIDED/);
  assert.match(inventory, /least-privilege/i);
  assert.match(inventory, /trace_id/i);
  assert.match(inventory, /correlation_id/i);
  assert.match(inventory, /synthetic(?:-only| and non-identifying| data only)/i);

  const gateLine = inventory.match(/^- Gate:.*$/m)?.[0] ?? "";
  assert.match(gateLine, /independent review found one stale next-gate reference requiring correction\. after this correction, the next gate is a new independent QA review/i);
  assert.match(gateLine, /does not close us-0003 acceptance or production privacy\/compliance/i, "the gate line must keep its non-approval wording");
  assert.doesNotMatch(gateLine, /t_[a-z0-9]+/i, "future gate must not depend on a transient Kanban task ID");
  assert.doesNotMatch(inventory, /t_fbf9da97|t_b3a7ca0d|t_dbaf9c0e/);
  assert.doesNotMatch(inventory, /\bt_[a-z0-9]{8}\b/i, "the inventory must not embed transient Kanban task IDs");
  assert.doesNotMatch(inventory, /^Pro\s*$/m, "inventory must not contain the orphaned truncation fragment");
});
