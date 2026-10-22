// Click a column header to sort a table's rows.
//
// Opt in with class="sortable" on the <table> and data-sort="string" | "number"
// on each sortable <th>. Columns sort ascending, unless the <th> has
// data-sort-dir="desc" (e.g. for percentages, where higher is better).
// A cell may set data-value to override its sort key (otherwise the cell's
// text is used); empty keys always sort last.

for (const table of document.querySelectorAll<HTMLTableElement>('table.sortable')) {
  const headers = table.querySelectorAll<HTMLTableCellElement>('th[data-sort]');
  const tbody = table.querySelector('tbody');
  if (!tbody) continue;

  headers.forEach((th) => {
    th.addEventListener('click', () => {
      headers.forEach((h) => h.classList.remove('sort-asc', 'sort-desc'));
      const descending = th.dataset.sortDir === 'desc';
      th.classList.add(descending ? 'sort-desc' : 'sort-asc');

      const index = th.cellIndex;
      const numeric = th.dataset.sort === 'number';
      const key = (row: HTMLTableRowElement) =>
        row.cells[index].dataset.value ?? row.cells[index].textContent?.trim() ?? '';
      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        const aVal = key(a);
        const bVal = key(b);
        if (aVal === '' || bVal === '') return (aVal === '' ? 1 : 0) - (bVal === '' ? 1 : 0);
        const order = numeric ? Number(aVal) - Number(bVal) : aVal.localeCompare(bVal);
        return descending ? -order : order;
      });

      for (const row of rows) tbody.append(row);
    });
  });
}
