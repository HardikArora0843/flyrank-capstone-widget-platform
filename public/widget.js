(function () {
  'use strict';

  // 1. Identify current script tag and extract Widget ID and Base URL
  const currentScript =
    document.currentScript ||
    (function () {
      const scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  if (!currentScript) {
    console.error('[FlyRank Widget] Unable to locate loader script tag.');
    return;
  }

  const scriptSrc = currentScript.src || '';
  let widgetId = null;
  let baseUrl = window.location.origin;

  try {
    const url = new URL(scriptSrc, window.location.href);
    baseUrl = url.origin;
    widgetId = url.searchParams.get('id') || currentScript.getAttribute('data-widget-id');
  } catch (e) {
    widgetId = currentScript.getAttribute('data-widget-id');
  }

  if (!widgetId) {
    console.error('[FlyRank Widget] Missing required widget ID. Pass ?id=<UUID> in script src or data-widget-id.');
    return;
  }

  // 2. Fetch Widget Public Configuration
  fetch(`${baseUrl}/api/widgets/${widgetId}/config`)
    .then(function (res) {
      if (!res.ok) {
        throw new Error('Failed to load widget configuration (HTTP ' + res.status + ')');
      }
      return res.json();
    })
    .then(function (config) {
      renderWidget(config, baseUrl);
    })
    .catch(function (err) {
      console.error('[FlyRank Widget] Init Error:', err);
    });

  // 3. DOM Rendering and Submission Handling
  function renderWidget(config, apiBase) {
    const containerId = 'flyrank-widget-' + config.id;
    if (document.getElementById(containerId)) return; // Prevent duplicate injection

    const wrapper = document.createElement('div');
    wrapper.id = containerId;
    wrapper.className = 'flyrank-widget-root ' + (config.type === 'popover' ? 'flyrank-popover' : 'flyrank-inline');

    // Inline CSS styling (scoped and isolated)
    const style = document.createElement('style');
    style.textContent = `
      #${containerId} {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1f2937;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        max-width: 420px;
        margin: 16px auto;
        box-sizing: border-box;
      }
      #${containerId}.flyrank-popover {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
      }
      #${containerId} h3 {
        margin: 0 0 8px 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: #111827;
      }
      #${containerId} p {
        margin: 0 0 16px 0;
        font-size: 0.875rem;
        color: #4b5563;
        line-height: 1.4;
      }
      #${containerId} .flyrank-field {
        margin-bottom: 12px;
      }
      #${containerId} label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        margin-bottom: 4px;
        color: #374151;
      }
      #${containerId} input, #${containerId} textarea {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 0.875rem;
        box-sizing: border-box;
        transition: border-color 0.15s ease;
      }
      #${containerId} input:focus, #${containerId} textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      #${containerId} button.flyrank-submit-btn {
        width: 100%;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 10px 16px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
        margin-top: 8px;
      }
      #${containerId} button.flyrank-submit-btn:hover {
        background: #1d4ed8;
      }
      #${containerId} button.flyrank-submit-btn:disabled {
        background: #93c5fd;
        cursor: not-allowed;
      }
      #${containerId} .flyrank-message {
        margin-top: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.875rem;
        display: none;
      }
      #${containerId} .flyrank-message.success {
        background: #def7ec;
        color: #03543f;
        display: block;
      }
      #${containerId} .flyrank-message.error {
        background: #fde8e8;
        color: #9b1c1c;
        display: block;
      }
      #${containerId} .flyrank-hp {
        display: none !important;
        position: absolute !important;
        left: -9999px !important;
      }
    `;
    document.head.appendChild(style);

    // Build form fields HTML
    const fields = config.fields || [];
    let fieldsHtml = '';
    fields.forEach(function (f) {
      fieldsHtml += `
        <div class="flyrank-field">
          <label for="${containerId}-${f.name}">${escapeHtml(f.label || f.name)}${f.required ? ' *' : ''}</label>
          ${
            f.type === 'textarea'
              ? `<textarea id="${containerId}-${f.name}" name="${f.name}" ${f.required ? 'required' : ''} placeholder="${escapeHtml(f.placeholder || '')}"></textarea>`
              : `<input type="${escapeHtml(f.type || 'text')}" id="${containerId}-${f.name}" name="${f.name}" ${f.required ? 'required' : ''} placeholder="${escapeHtml(f.placeholder || '')}" />`
          }
        </div>
      `;
    });

    wrapper.innerHTML = `
      <h3>${escapeHtml(config.title || 'Get in Touch')}</h3>
      ${config.description ? `<p>${escapeHtml(config.description)}</p>` : ''}
      <form id="${containerId}-form" novalidate>
        <!-- Invisible Honeypot Spam Trap -->
        <input type="text" name="_hp_website" class="flyrank-hp" tabindex="-1" autocomplete="off" />
        ${fieldsHtml}
        <button type="submit" class="flyrank-submit-btn">${escapeHtml(config.buttonText || 'Submit')}</button>
        <div class="flyrank-message" id="${containerId}-msg"></div>
      </form>
    `;

    // Append to target container or document body
    const targetElement = document.getElementById('flyrank-widget-target') || document.body;
    targetElement.appendChild(wrapper);

    // Attach form submission handler
    const form = document.getElementById(containerId + '-form');
    const msgBox = document.getElementById(containerId + '-msg');
    const submitBtn = form.querySelector('button.flyrank-submit-btn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Collect data
      const formData = new FormData(form);
      const data = {};
      let honeypotVal = '';

      formData.forEach(function (value, key) {
        if (key === '_hp_website') {
          honeypotVal = value;
        } else {
          data[key] = value;
        }
      });

      // Simple client validation check
      let hasClientError = false;
      fields.forEach(function (f) {
        if (f.required && (!data[f.name] || !String(data[f.name]).trim())) {
          hasClientError = true;
        }
      });

      if (hasClientError) {
        msgBox.className = 'flyrank-message error';
        msgBox.textContent = 'Please complete all required fields.';
        return;
      }

      // Submit state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      msgBox.className = 'flyrank-message';
      msgBox.style.display = 'none';

      const payload = {
        widgetId: config.id,
        data: data,
        _hp_website: honeypotVal,
      };

      fetch(`${apiBase}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { ok: res.ok, status: res.status, body: body };
          });
        })
        .then(function (result) {
          submitBtn.disabled = false;
          submitBtn.textContent = config.buttonText || 'Submit';

          if (result.ok) {
            msgBox.className = 'flyrank-message success';
            msgBox.textContent = '✓ Thank you! Your submission has been received.';
            form.reset();
          } else {
            msgBox.className = 'flyrank-message error';
            msgBox.textContent =
              result.body?.error?.message || 'Submission failed. Please check your information and try again.';
          }
        })
        .catch(function (networkErr) {
          submitBtn.disabled = false;
          submitBtn.textContent = config.buttonText || 'Submit';
          msgBox.className = 'flyrank-message error';
          msgBox.textContent = 'Network error. Please try again.';
          console.error('[FlyRank Widget] Submission Error:', networkErr);
        });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
