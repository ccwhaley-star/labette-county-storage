// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const isOpen = navLinks.classList.contains('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close nav when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      // Close any open dropdowns
      document.querySelectorAll('.nav-dropdown.open').forEach(d => d.classList.remove('open'));
    });
  });
}

// Escape closes the mobile nav drawer + any open dropdown, and returns
// focus to the toggle (keyboard users were previously stuck).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (navLinks && navLinks.classList.contains('open')) {
    navLinks.classList.remove('open');
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.focus();
    }
  }
  document.querySelectorAll('.nav-dropdown.open').forEach(d => {
    d.classList.remove('open');
    const t = d.querySelector('.nav-dropdown-toggle');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
});

// Nav dropdown toggle
document.querySelectorAll('.nav-dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = toggle.parentElement;
    const isOpen = dropdown.classList.contains('open');

    // Close all dropdowns first
    document.querySelectorAll('.nav-dropdown.open').forEach(d => d.classList.remove('open'));

    if (!isOpen) {
      dropdown.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.nav-dropdown.open').forEach(d => {
    d.classList.remove('open');
    d.querySelector('.nav-dropdown-toggle').setAttribute('aria-expanded', 'false');
  });
});

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.parentElement;
    const isOpen = item.classList.contains('open');

    // Close all others
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      openItem.classList.remove('open');
      openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });

    // Toggle current
    if (!isOpen) {
      item.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
    } else {
      button.setAttribute('aria-expanded', 'false');
    }
  });
});

// Scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.animate-in').forEach(el => {
  observer.observe(el);
});

// Sticky header shadow on scroll
const header = document.querySelector('.header');
if (header) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
    } else {
      header.style.boxShadow = '0 1px 10px rgba(0,0,0,0.06)';
    }
  }, { passive: true });
}


// Phone click tracking (GA4 key event)
document.querySelectorAll('a[href^="tel:"]').forEach(el => {
  el.addEventListener('click', () => {
    if (typeof gtag === 'function') {
      gtag('event', 'phone_call', {
        event_category: 'contact',
        event_label: el.getAttribute('href').replace('tel:', '')
      });
    }
  });
});


// Rent click tracking (GA4 key event) — fires on rental-intent links, never on Pay/Login
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (/\/login/i.test(href)) return;
  if (/(\/pages\/rent|openreservation|\/reserve)/i.test(href) && typeof gtag === 'function') {
    gtag('event', 'rent_click', { event_category: 'conversion_intent', event_label: href, transport_type: 'beacon' });
  }
}, true);
