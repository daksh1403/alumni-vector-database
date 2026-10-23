
const $ = id => document.getElementById(id);

const state = {
  kind: 'alumni',
  browse: false,
  offset: null,
  records: [],
  busy: false
};

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

import {
  api,
  post,
  searchMentors,
  searchRecords,
  getMentors,
  getJobs,
  getRecords,
  getHealth,
  getStats,
  getFacets
} from './js/api.js';


const provenance = p =>
  p.synthetic
    ? 'Demo'
    : p.origin === 'neo4j-migration'
      ? 'Original record'
      : 'Added record';

const titleCase = s =>
  s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function setMode(kind) {
  state.kind = kind;
  $('.network-art').dataset.category = kind;
  $('record-kind').value = kind;

  document.querySelectorAll('[data-kind]').forEach(b => {
    const on = b.dataset.kind === kind;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });

  const label = kind === 'job' ? 'jobs'
    : kind === 'mentorship' ? 'mentoring'
    : kind === 'alumni' ? 'alumni'
    : 'records';

  $('query').placeholder = kind === 'job'
    ? 'e.g. A cloud engineering internship'
    : kind === 'mentorship'
      ? 'e.g. Help improving my design portfolio'
      : 'e.g. An alumnus who knows machine learning';

  $('browse-mobile').textContent = 'Browse ' + label + ' instead';
  $('browse-toggle').textContent = 'Browse all ' + label;
}

function filterValues() {
  const v = {};

  for (const id of ['department', 'skill', 'location']) {
    if ($(id).value) v[id] = $(id).value;
  }

  if (state.kind) v.kind = state.kind;

  if ($('source').value) {
    v.synthetic = $('source').value === 'synthetic';
  }

  return v;
}

function showError(error) {
  $('error').textContent = error.message || 'Something went wrong. Please try again.';
  $('error').hidden = false;
}

function render(records, append = false) {
  if (!append) $('results').replaceChildren();

  state.records = append
    ? [...state.records, ...records]
    : records;

  if (!records.length && !append) {
    const box = el('div', undefined, 'welcome');
    const symbol = el('span', '◎', 'welcome-symbol');
    symbol.setAttribute('aria-hidden', 'true');
    const textWrap = el('div');
    textWrap.append(
      el('h3', 'No matches found'),
      el('p', 'Try a broader description, different keywords, or clear some filters.')
    );
    box.append(symbol, textWrap);
    $('results').append(box);
    return;
  }

  records.forEach((record, i) => {
    const p = record.payload || {
      kind: 'alumni',
      title: record.name ? `${record.name}${record.role ? ' · ' + record.role : ''}` : 'Untitled record',
      description: record.match_reason || '',
      skills: record.skills || [],
      location: record.city || '',
      synthetic: false
    };
    const rank = state.browse ? null : i + 1;
    const card = el('article', undefined, 'result-card');

    card.append(
      el('div', rank ? String(rank).padStart(2, '0') : '↗', 'rank')
    );

    card.style.setProperty('--card-index', String(i));

    const content = el('div');
    const top = el('div', undefined, 'card-top');

    top.append(
      el(
        'span',
        p.kind === 'job' ? 'Job'
          : p.kind === 'mentorship' ? 'Mentoring'
          : titleCase(p.kind || 'record'),
        'kind-label'
      ),
      el('span', provenance(p), p.synthetic ? 'synthetic' : 'original')
    );

    content.append(
      top,
      el('h3', p.title || 'Untitled record'),
      el(
        'p',
        (p.description || '').length > 260
          ? (p.description || '').slice(0, 257) + '…'
          : (p.description || '')
      )
    );

    const tags = el('div', undefined, 'tags');

    for (const s of (p.skills || []).slice(0, 5)) {
      tags.append(el('span', s, 'tag'));
    }

    for (const s of [
      p.department?.toUpperCase(),
      p.location && titleCase(p.location)
    ]) {
      if (s) tags.append(el('span', s, 'tag'));
    }

    content.append(tags);
    card.append(content);

    const action = el('button', 'View details', 'card-action');
    action.setAttribute('aria-label', 'View details for ' + (p.title || 'record'));
    action.onclick = () => details(record.id);

    card.append(action);
    $('results').append(card);
  });
}

async function search(event) {
  event?.preventDefault();

  if (state.busy) return;

  const query = $('query').value.trim();
  if (!query) {
    $('query').focus();
    return;
  }

  state.busy = true;
  state.browse = false;
  $('search-button').disabled = true;
  $('results').setAttribute('aria-busy', 'true');
  $('search-button').textContent = 'Searching…';
  $('error').hidden = true;
  $('load-more').hidden = true;
  $('result-info').textContent = 'Finding connections…';

  try {
    const f = filterValues();
    let data;
    if (state.kind === 'alumni') {
      data = await searchMentors({
        query,
        ...(f.department ? { domain: f.department } : {}),
        ...(f.location ? { city: f.location } : {})
      });
    } else {
      data = await searchRecords({
        query,
        ...f
      });
    }

    const results = data.results || [];
    render(results);
    $('results-heading').textContent = 'Best matches';

    if (!results.length) {
      $('result-info').textContent = '0 results · Try adjusting filters';
      $('score-note').hidden = true;
    } else {
      $('result-info').textContent =
        `${results.length} ${results.length === 1 ? 'result' : 'results'} · Most relevant first`;
      $('score-note').hidden = false;
    }
  } catch (error) {
    showError(error);
    $('result-info').textContent = 'Search could not complete.';
    $('score-note').hidden = true;
  } finally {
    state.busy = false;
    $('search-button').disabled = false;
    $('search-button').textContent = 'Search';
    $('results').setAttribute('aria-busy', 'false');
  }
}

async function browse(append = false) {
  if (state.busy) return;

  state.busy = true;
  state.browse = true;
  $('error').hidden = true;

  if (!append) {
    $('load-more').hidden = true;
    $('result-info').textContent = 'Loading records…';
    $('results').setAttribute('aria-busy', 'true');
  } else {
    $('load-more').disabled = true;
    $('load-more').textContent = 'Loading…';
  }

  try {
    const f = filterValues();
    const params = new URLSearchParams();

    for (const [k, v] of Object.entries(f)) {
      params.set(k, String(v));
    }

    if (append && state.offset) {
      params.set('offset', state.offset);
    }

    const data = await api('records?' + params);
    const results = data.results || [];
    render(results, append);

    state.offset = data.nextOffset;
    $('load-more').hidden = !state.offset;

    $('results-heading').textContent =
      'Browse ' + (
        state.kind === 'job' ? 'jobs'
        : state.kind === 'mentorship' ? 'mentoring'
        : state.kind || 'all records'
      );

    if (!results.length && !append) {
      $('result-info').textContent = 'No records found with these filters.';
    } else {
      $('result-info').textContent =
        'Showing 5 at a time. Open a result to learn more.';
    }
    $('score-note').hidden = true;
    if (!append) {
      $('discover').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    showError(error);
  } finally {
    state.busy = false;
    $('load-more').disabled = false;
    $('load-more').textContent = 'Show 5 more';
    $('results').setAttribute('aria-busy', 'false');
  }
}

async function refresh() {
  try {
    const s = await getStats();

    $('connection').textContent = '● Connected';
    $('connection').classList.add('online');
    $('total').textContent = s.points;

    const counts = Object.fromEntries(
      (s.counts || []).map(c => [c.value, c.count])
    );

    $('counts').textContent =
      `${counts.alumni || 0} alumni · ${counts.job || 0} jobs · ${counts.mentorship || 0} mentoring records`;

    $('notice').hidden = true;

    const f = await getFacets();

    for (const [id, key] of [
      ['department', 'department'],
      ['skill', 'skills'],
      ['location', 'location']
    ]) {
      const current = $(id).value;

      $(id).querySelectorAll('option:not(:first-child)')
        .forEach(o => o.remove());

      for (const v of (f[key] || [])) {
        if (!v) continue;

        const o = el(
          'option',
          id === 'department' ? v.toUpperCase() : titleCase(v)
        );

        o.value = v;
        $(id).append(o);
      }

      $(id).value = current;
    }
  } catch (error) {
    $('connection').textContent = '○ Unavailable';
    $('connection').classList.remove('online');
    $('counts').textContent = 'Service unavailable';
    $('notice').textContent = error.message;
    $('notice').hidden = false;
  }
}

async function details(id) {
  const dialog = $('details');
  $('detail-content').replaceChildren(el('p', 'Loading record…'));

  if (!dialog.open) dialog.showModal();

  try {
    const { record } = await api('records/' + id);
    const p = record?.payload || {};
    const root = $('detail-content');

    root.replaceChildren(
      el('p', (p.kind || 'record').toUpperCase() + ' · ' + provenance(p).toUpperCase(), 'eyebrow'),
      el('h2', p.title || 'Untitled record', 'detail-title'),
      el('p', p.description || '', 'detail-text')
    );

    const tags = el('div', undefined, 'detail-meta');

    for (const s of [
      ...(p.skills || []),
      p.department?.toUpperCase(),
      p.location
    ].filter(Boolean)) {
      tags.append(el('span', s, 'tag'));
    }

    root.append(tags);

    const actions = el('div', undefined, 'detail-actions');
    const match = el(
      'button',
      p.kind === 'job'
        ? 'Find alumni with these skills ↗'
        : 'Find related opportunities ↗'
    );

    match.onclick = () => {
      dialog.close();
      setMode(p.kind === 'job' ? 'alumni' : 'job');
      $('query').value = [p.title, ...(p.skills || [])].join(' ');
      search();
      $('discover').scrollIntoView({ behavior: 'smooth' });
    };

    actions.append(match);

    if ($('admin-token').value) {
      const edit = el('button', 'Edit record');

      edit.onclick = () => {
        dialog.close();
        editRecord(record);
      };

      const del = el('button', 'Delete record');

      del.onclick = async () => {
        if (!confirm('Delete this record?')) return;

        try {
          await api('records/' + id, {
            method: 'DELETE',
            headers: {
              Authorization: 'Bearer ' + $('admin-token').value
            }
          });

          dialog.close();
          await refresh();
          browse();
        } catch (e) {
          root.append(el('p', e.message, 'error'));
        }
      };

      actions.append(edit, del);
    }

    root.append(actions);

    if (p.relationships?.length) {
      root.append(el('h3', 'Connected records'));

      const list = el('ul', undefined, 'detail-links');

      for (const relation of p.relationships) {
        const li = el('li');
        const button = el(
          'button',
          (relation.direction === 'in' ? '← ' : '→ ') +
          titleCase(relation.type.toLowerCase().replaceAll('_', ' ')) +
          ' · Open record ↗'
        );

        button.onclick = () => details(relation.target);
        li.append(button);
        list.append(li);
      }

      root.append(list);
    }

    if (p.source_properties) {
      const section = el('details');
      const summary = el('summary', 'Original record data');

      section.append(
        summary,
        el('pre', JSON.stringify(p.source_properties, null, 2), 'raw')
      );

      root.append(section);
    }
  } catch (error) {
    $('detail-content').replaceChildren(
      el('p', error.message, 'error')
    );
  }
}

function editRecord(record) {
  const p = record?.payload || {};

  $('record-form').hidden = false;
  $('edit-id').value = record?.id || '';

  for (const k of [
    'kind', 'title', 'description', 'department', 'location'
  ]) {
    $('edit-' + k).value = p[k] || (k === 'kind' ? 'alumni' : '');
  }

  $('edit-skills').value = (p.skills || []).join(', ');
  $('edit-synthetic').checked = Boolean(p.synthetic);
  $('admin-status').textContent = '';
  document.querySelector('.admin-panel').open = true;
  $('record-form').scrollIntoView({ behavior: 'smooth' });
}

$('record-form').onsubmit = async event => {
  event.preventDefault();

  $('save-record').disabled = true;
  $('admin-status').textContent = 'Embedding and saving…';

  try {
    const id = $('edit-id').value;
    const data = {};

    for (const k of [
      'kind', 'title', 'description', 'department', 'location'
    ]) {
      data[k] = $('edit-' + k).value;
    }

    data.skills = $('edit-skills').value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    data.synthetic = $('edit-synthetic').checked;

    await post('records' + (id ? '/' + id : ''), data, id ? 'PUT' : 'POST');

    $('admin-status').textContent = 'Saved and indexed.';
    $('record-form').hidden = true;
    setMode(data.kind);

    for (const key of [
      'department', 'skill', 'location', 'source'
    ]) {
      $(key).value = '';
    }

    await refresh();
    await browse();

    $('result-info').textContent =
      'Record saved and indexed · Five records at a time.';
  } catch (error) {
    $('admin-status').textContent = error.message;
  } finally {
    $('save-record').disabled = false;
  }
};

$('add-record').onclick = () => editRecord();
$('cancel-record').onclick = () => {
  $('record-form').hidden = true;
};

$('search-form').onsubmit = search;

document.querySelectorAll('[data-kind]').forEach(b => {
  b.onclick = () => {
    setMode(b.dataset.kind);
    state.browse = false;
    $('query').focus();
  };
});

document.querySelectorAll('[data-example]').forEach(b => {
  b.onclick = () => {
    setMode(b.dataset.mode);
    $('query').value = b.dataset.example;
    search();
  };
});

$('record-kind').onchange = () => {
  setMode($('record-kind').value);
  if (state.browse) browse();
};

$('filter-toggle').onclick = () => {
  $('filters').hidden = !$('filters').hidden;
  $('filter-toggle').setAttribute(
    'aria-expanded',
    String(!$('filters').hidden)
  );
  $('filter-toggle').textContent =
    $('filters').hidden ? 'Add filters' : 'Hide filters';
};

$('clear-filters').onclick = () => {
  for (const id of [
    'department', 'skill', 'location', 'source'
  ]) {
    $(id).value = '';
  }
};

$('browse-toggle').onclick = () => browse();
$('browse-mobile').onclick = () => browse();
$('load-more').onclick = () => browse(true);
$('close-details').onclick = () => $('details').close();

$('details').onclick = e => {
  if (e.target === $('details')) {
    const rect = $('details').getBoundingClientRect();

    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      $('details').close();
    }
  }
};

$('query').onkeydown = e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    search();
  }
};

const motionToggle = $('motion-toggle');

motionToggle.onclick = () => {
  const paused = document.documentElement.classList.toggle('motion-paused');

  motionToggle.setAttribute('aria-pressed', String(paused));
  motionToggle.textContent = paused ? 'Play animation' : 'Pause animation';
};

setMode(state.kind);
refresh();
