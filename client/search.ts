// Client-side search integration
// In v1, provides basic filter-as-you-type over nav items
// Pagefind integration planned for build-time indexing

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  if (!input) return;

  const navLinks = Array.from(document.querySelectorAll('.sidebar nav a'));

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();

    for (const link of navLinks) {
      const li = link.closest('li') as HTMLElement | null;
      if (!li) continue;

      if (!query) {
        li.style.display = '';
        continue;
      }

      const text = link.textContent?.toLowerCase() || '';
      li.style.display = text.includes(query) ? '' : 'none';
    }
  });
});
