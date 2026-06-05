const PROFILE_LINK_KEYS = {
  userId:      { nameKey: 'username',      idKey: 'userId' },
  recruiterId: { nameKey: 'recruiterName', idKey: 'recruiterId' },
};

const SKIP_KEYS = new Set(['username', 'recruiterName']);

const LABELS = {
  userId:       'User',
  recruiterId:  'Recruiter',
  level:        'Level',
  age:          'Age',
  rank:         'Rank',
  property:     'Property',
  awards:       'Awards',
  donatorStatus:'Donator',
  lastAction:   'Last Action',
  sentAt:       'Sent',
  resolvedAt:   'Resolved',
  joined:       'Joined',
};

const DATE_KEYS = new Set(['sentAt', 'resolvedAt']);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let sortKey = null;
let sortDir = 1;
let secondarySortKey = null;
let recruitsData = [];
let columnsData = [];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d)) return '—';
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

function toTitleCase(str) {
  if (!str) return '—';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ---------------------------------------------------------------------------
// Sort value extraction
// ---------------------------------------------------------------------------
function getSortValue(record, key) {
  if (key === 'recruiterId') return (record.recruiterName || '').toLowerCase();
  if (key === 'userId')      return (record.username || '').toLowerCase();
  if (key === 'joined') {
    if (record.joined === null || record.joined === undefined) return 0;
    return record.joined ? 1 : -1;
  }
  if (DATE_KEYS.has(key)) {
    const d = new Date(record[key]);
    return isNaN(d) ? 0 : d.getTime();
  }
  const v = record[key];
  if (typeof v === 'number') return v;
  return (v || '').toString().toLowerCase();
}

function compareRecords(a, b, key, dir) {
  const av = getSortValue(a, key);
  const bv = getSortValue(b, key);
  if (av < bv) return -1 * dir;
  if (av > bv) return  1 * dir;
  return 0;
}

function sortedData() {
  if (!sortKey) return [...recruitsData];
  return [...recruitsData].sort((a, b) => {
    const primary = compareRecords(a, b, sortKey, sortDir);
    if (primary !== 0) return primary;
    // Secondary sort only when primary is recruiterId
    if (sortKey === 'recruiterId' && secondarySortKey) {
      return compareRecords(a, b, secondarySortKey, 1);
    }
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderProfileLink(td, name, id) {
  if (!name || !id) { td.textContent = 'Unknown User'; return; }
  const a = document.createElement('a');
  a.href = `https://www.torn.com/profiles.php?XID=${id}`;
  a.className = 'profile-link';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = `${name} [${id}]`;
  td.appendChild(a);
}

function renderCell(key, record) {
  const td = document.createElement('td');
  const val = record[key];

  if (PROFILE_LINK_KEYS[key]) {
    const { nameKey, idKey } = PROFILE_LINK_KEYS[key];
    td.className = 'col-left';
    renderProfileLink(td, record[nameKey], record[idKey]);
    return td;
  }

  if (DATE_KEYS.has(key)) {
    td.textContent = formatDate(val);
    return td;
  }

  if (key === 'joined') {
    const badge = document.createElement('span');
    if (val === null || val === undefined) {
      badge.className = 'badge badge-pending';
      badge.textContent = 'Pending';
    } else if (val) {
      badge.className = 'badge badge-yes';
      badge.textContent = 'Yes';
    } else {
      badge.className = 'badge badge-no';
      badge.textContent = 'No';
    }
    td.appendChild(badge);
    return td;
  }

  if (key === 'donatorStatus') {
    const status = val ? val.toLowerCase() : '';
    if (status === 'donator' || status === 'subscriber') {
      const star = document.createElement('span');
      star.className = `star star-${status}`;
      star.textContent = '★';
      star.title = status.charAt(0).toUpperCase() + status.slice(1);
      td.appendChild(star);
    } else {
      td.textContent = val || '—';
    }
    return td;
  }

  if (key === 'property') {
    td.textContent = toTitleCase(val);
    return td;
  }

  td.textContent = val !== undefined && val !== null ? val : '—';
  return td;
}

function getColumns(record) {
  return Object.keys(record).filter(k => !SKIP_KEYS.has(k));
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function buildHeader(columns) {
  const thead = document.getElementById('table-head');
  thead.innerHTML = '';

  // Row 1 - sortable column headers
  const tr = document.createElement('tr');
  tr.id = 'header-row';
  columns.forEach(key => {
    const th = document.createElement('th');
    th.dataset.key = key;
    if (PROFILE_LINK_KEYS[key]) th.classList.add('col-left');
    th.classList.add('sortable');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'th-label';
    labelSpan.textContent = LABELS[key] || key;

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'sort-arrow';

    th.appendChild(labelSpan);
    th.appendChild(arrowSpan);
    th.addEventListener('click', () => onHeaderClick(key));
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // Row 2 - secondary sort (hidden until Recruiter is primary sort)
  const tr2 = document.createElement('tr');
  tr2.id = 'secondary-sort-row';
  tr2.style.display = 'none';

  columns.forEach(key => {
    const td = document.createElement('td');
    td.className = 'secondary-sort-cell';
    td.dataset.key = key;
    if (PROFILE_LINK_KEYS[key]) td.classList.add('col-left');

    if (key === 'recruiterId') {
      const label = document.createElement('span');
      label.className = 'secondary-sort-label';
      label.textContent = 'Secondary Sort';
      td.appendChild(label);
    } else {
      const btn = document.createElement('button');
      btn.className = 'secondary-sort-btn';
      btn.dataset.key = key;
      btn.textContent = '↕';
      btn.title = `Secondary sort by ${LABELS[key] || key}`;
      btn.addEventListener('click', () => {
        secondarySortKey = secondarySortKey === key ? null : key;
        refreshSecondarySort();
        buildRows(columnsData);
      });
      td.appendChild(btn);
    }
    tr2.appendChild(td);
  });
  thead.appendChild(tr2);
  refreshHeaderArrows();
}

function refreshHeaderArrows() {
  document.querySelectorAll('#header-row th').forEach(th => {
    const key = th.dataset.key;
    const arrow = th.querySelector('.sort-arrow');
    if (key === sortKey) {
      th.classList.add('sort-active');
      arrow.textContent = sortDir === 1 ? ' ↑' : ' ↓';
    } else {
      th.classList.remove('sort-active');
      arrow.textContent = '';
    }
  });
}

function onHeaderClick(key) {
  if (sortKey === key) {
    sortDir = sortDir * -1;
  } else {
    sortKey = key;
    sortDir = 1;
    if (key !== 'recruiterId') secondarySortKey = null;
  }
  refreshHeaderArrows();
  refreshSecondarySort();
  buildRows(columnsData);
}

// ---------------------------------------------------------------------------
// Secondary sort row
// ---------------------------------------------------------------------------
function refreshSecondarySort() {
  const row = document.getElementById('secondary-sort-row');
  if (!row) return;

  if (sortKey !== 'recruiterId') {
    row.style.display = 'none';
    return;
  }

  row.style.display = '';
  row.querySelectorAll('.secondary-sort-btn').forEach(btn => {
    const key = btn.dataset.key;
    btn.classList.toggle('active', key === secondarySortKey);
    btn.title = `Secondary sort by ${LABELS[key] || key}`;
  });
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
function buildRows(columns) {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  const data = sortedData();
  data.forEach(r => {
    const tr = document.createElement('tr');
    columns.forEach(key => tr.appendChild(renderCell(key, r)));
    tbody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  try {
    const res = await fetch('data/recruits.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = await res.json();
    if (!all.length) throw new Error('No records found');

    const cutoff = Date.now() - THIRTY_DAYS_MS;
    recruitsData = all.filter(r => {
      if (!r.sentAt) return false;
      return new Date(r.sentAt).getTime() >= cutoff;
    });

    columnsData = getColumns(all[0]);
    buildHeader(columnsData);

    if (!recruitsData.length) {
      document.getElementById('table-body').innerHTML =
        `<tr class="error-row"><td colspan="${columnsData.length}">No recruits in the last 30 days.</td></tr>`;
      return;
    }

    buildRows(columnsData);
  } catch (e) {
    document.getElementById('table-body').innerHTML =
      `<tr class="error-row"><td colspan="99">No recruits!</td></tr>`;
  }
}

init();
