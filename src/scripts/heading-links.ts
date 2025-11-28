// Add permalink anchors to h2 headings in .prose sections

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const slugCounts = new Map<string, number>();

document.querySelectorAll('.prose h2').forEach((h2) => {
  const text = h2.textContent || '';
  let slug = slugify(text);

  // Handle duplicates
  const count = slugCounts.get(slug) || 0;
  if (count > 0) slug = `${slug}-${count}`;
  slugCounts.set(slug, count + 1);

  // Add id if missing
  if (!h2.id) h2.id = slug;

  // Create and insert the anchor link
  const link = document.createElement('a');
  link.href = `#${h2.id}`;
  link.className = 'heading-link';
  link.setAttribute('aria-hidden', 'true');
  link.tabIndex = -1;
  link.innerHTML = '<span class="link-icon">#</span>';
  h2.insertBefore(link, h2.firstChild);
});
