// The web account page (S2-24; spec 2 *Deletion*, Amendments 1 C2, 3 §3–4,
// 8 §5, 9 §1–2): sign in with an email code, then the deletion choice
// (schedule deletion, or Delete permanently now) after Confirm it's you,
// Cancel deletion during the window, and deletion status (scheduled with its
// deadline, processing, completed). Lifecycle only: no gameplay. Billing help
// shows both stores' subscription management and refund-request paths, since
// a browser doesn't say which store the player bought through.
//
// Plain DOM, rendered from one state: each view is a fresh tree under <main>.
// A new view moves focus to its heading; within a view, focus stays on the
// control that had it (or moves to the field a step asks for). Messages go
// to live regions that stay in place, so screen readers announce them.
// TODO(frames): unverified against S2-24 — the frame couldn't be read (Pencil unreachable). The copy and layout come from spec 2 *Deletion* and Amendments 1 B1, C2, 3 §3–4, 8 §5 and 9 §1–2, and the app's S2-22/S2-23 screens.

import {
  BACKUPS_DETAIL,
  CANCEL_FAILED,
  CANCEL_TOO_LATE,
  type CodeRequestResult,
  DELETION_UNKNOWN,
  type DeletionProgress,
  PROVIDER_GRANT_DETAIL,
  SCHEDULE_UNKNOWN,
  STORES,
  WEB_PAGES,
  type WebAccount,
  type WebAccountView,
  analyticsDetail,
  dayText,
  deletionDetail,
  scheduledDetail,
} from '@tableside/account/web';

/** A deletion action, which may first need Confirm it's you. */
type Action = 'schedule' | 'cancel' | 'delete';

interface PageState {
  busy: boolean;
  /** The email typed on the sign-in step; the code step once a code was sent. */
  email: string;
  codeSentTo: string | null;
  /** This session confirmed it's the player (for the server's few minutes). */
  confirmed: boolean;
  /** Confirm it's you is asked for: a code was sent, and the action to run once confirmed, if any. */
  confirming: { readonly codeSent: boolean; readonly then: Action | null } | null;
  /** Delete permanently now's own warnings are showing. */
  permanent: boolean;
  /** An announcement (role=status) and a problem (role=alert). */
  notice: string;
  problem: string;
  /** The field to focus after the next render. */
  focus: string | null;
}

const NEEDS_CONNECTION = "Couldn't reach Tableside. Check your connection and try again.";
const INVALID_CODE = "That code isn't right, or it has expired. Check it, or send a new code.";

export function mountAccountPage(main: HTMLElement, account: WebAccount): Promise<void> {
  const doc = main.ownerDocument;
  const state: PageState = { busy: false, email: '', codeSentTo: null, confirmed: false, confirming: null, permanent: false, notice: '', problem: '', focus: null };

  // The live regions stay in place across renders, so changes to them are announced.
  const content = doc.createElement('div');
  const status = el('p', { role: 'status', class: 'note' });
  const alert = el('p', { role: 'alert', class: 'problem' });

  let screen = '';
  // The control that last had focus: a busy render disables it (which drops
  // focus), so it is remembered here rather than read back from the document.
  let lastFocus: string | undefined;
  main.addEventListener('focusin', (event) => {
    const key = event.target instanceof HTMLElement ? event.target.dataset.focus : undefined;
    if (key) lastFocus = key;
  });

  function el(tag: string, attributes: Record<string, string | boolean> = {}, ...children: (Node | string | null | false)[]): HTMLElement {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (value === false) continue;
      node.setAttribute(name, value === true ? '' : value);
    }
    for (const child of children) if (child) node.append(child);
    return node;
  }

  const button = (label: string, variant: 'primary' | 'secondary' | 'ghost', focusKey: string, onClick: () => void | Promise<void>) => {
    const node = el('button', { type: 'button', class: variant, 'data-focus': focusKey, disabled: state.busy }, label);
    node.addEventListener('click', () => void onClick());
    return node;
  };

  const row = (title: string, detail: string | Node) => el('li', {}, el('span', { class: 'row-title' }, title), el('span', { class: 'row-detail' }, detail));

  const external = (label: string, url: string) =>
    el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label, el('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));

  function supportLinks() {
    return el(
      'nav',
      { class: 'support', 'aria-label': 'Help' },
      el('ul', {}, el('li', {}, external('Contact support', WEB_PAGES.contactSupport)), el('li', {}, external('Make a privacy request', WEB_PAGES.privacyRequest))),
      el('p', { class: 'note' }, 'These work without signing in.'),
    );
  }

  /** Both stores' billing help: deleting never cancels a subscription, and only the store decides a refund. */
  const billingHelp = () => [
    el('h2', {}, 'Your subscription'),
    el(
      'ul',
      { class: 'rows' },
      ...Object.values(STORES).flatMap((store) => [
        row(`Manage subscription · ${store.name}`, el('span', {}, "Deleting your account doesn't cancel it. ", external(`Open the ${store.name}`, store.manageUrl))),
        row(`Request a refund · ${store.name}`, el('span', {}, `The ${store.name} decides refunds. `, external(`Request one from the ${store.name}`, store.refundUrl))),
      ]),
    ),
  ];

  /** A form with one field and its submit button; Enter submits it. */
  const form = (
    field: { readonly id: string; readonly label: string; readonly attributes: Record<string, string | boolean>; readonly hint?: string },
    submit: string,
    onSubmit: (value: string) => void | Promise<void>,
  ) => {
    const hintId = `${field.id}-hint`;
    const input = el('input', {
      id: field.id,
      name: field.id,
      required: true,
      'data-focus': field.id,
      disabled: state.busy,
      ...(field.hint ? { 'aria-describedby': hintId } : {}),
      ...field.attributes,
    }) as HTMLInputElement;
    const node = el(
      'form',
      { novalidate: true },
      el('div', { class: 'field' }, el('label', { for: field.id }, field.label), field.hint ? el('span', { id: hintId, class: 'note' }, field.hint) : null, input),
      el('div', { class: 'actions' }, el('button', { type: 'submit', class: 'primary', 'data-focus': `${field.id}-submit`, disabled: state.busy }, submit)),
    );
    node.addEventListener('submit', (event) => {
      event.preventDefault();
      void onSubmit(input.value);
    });
    return { node, input };
  };

  /** Runs a step with the page busy, then renders what it left. */
  const run = async (step: () => Promise<void>) => {
    if (state.busy) return;
    state.busy = true;
    state.problem = '';
    state.notice = '';
    render();
    try {
      await step();
    } catch {
      state.problem = NEEDS_CONNECTION;
    } finally {
      state.busy = false;
      render();
    }
  };

  const codeProblem = (result: CodeRequestResult): string => {
    if (result.status === 'rate-limited') {
      const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
      return `Too many codes were asked for. Try again in ${minutes === 1 ? '1 minute' : `${minutes} minutes`}.`;
    }
    return "Couldn't send a code. Check your connection and try again.";
  };

  // ---- Signed out: sign in with an email code ------------------------------

  const sendSignInCode = (email: string) =>
    run(async () => {
      const address = email.trim();
      state.email = address;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        state.problem = 'Enter your email address, like name@example.com.';
        state.focus = 'email';
        return;
      }
      const result = await account.requestCode(address);
      if (result.status !== 'sent') {
        state.problem = codeProblem(result);
        state.focus = 'email';
        return;
      }
      state.codeSentTo = address;
      state.notice = "If an account exists for this address, we've sent a code.";
      state.focus = 'code';
    });

  const signIn = (code: string) =>
    run(async () => {
      if (!/^\d{6}$/.test(code.trim())) {
        state.problem = 'Enter the 6-digit code from the email.';
        state.focus = 'code';
        return;
      }
      const result = await account.signIn(state.codeSentTo ?? state.email, code);
      if (result.status === 'invalid-code') {
        state.problem = INVALID_CODE;
        state.focus = 'code';
        return;
      }
      if (result.status === 'failed') {
        state.problem = "Couldn't sign in. Check your connection and try again.";
        state.focus = 'code';
        return;
      }
      state.codeSentTo = null;
      state.confirmed = false;
      state.confirming = null;
      state.permanent = false;
    });

  const signedOutView = () => {
    if (state.codeSentTo === null) {
      const { node, input } = form(
        { id: 'email', label: 'Email', attributes: { type: 'email', autocomplete: 'email', inputmode: 'email', spellcheck: 'false' } },
        'Send code',
        sendSignInCode,
      );
      input.value = state.email;
      input.setAttribute('aria-invalid', String(state.problem !== '' && state.focus === 'email'));
      return [
        el('h1', { tabindex: '-1' }, 'Your Tableside account'),
        el('p', { class: 'lead' }, 'Sign in to delete your account, cancel a scheduled deletion or see how a deletion is going. Practice and play are in the app.'),
        node,
        el(
          'p',
          { class: 'note' },
          "Only signed in with Apple or Google? Add an email code to your account in the app first (More → Settings → Account → Sign-in methods), or contact support.",
        ),
      ];
    }
    const { node, input } = form(
      {
        id: 'code',
        label: 'Code',
        hint: `If an account exists for ${state.codeSentTo}, we've sent it a 6-digit code.`,
        attributes: { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', pattern: '[0-9]{6}' },
      },
      'Sign in',
      signIn,
    );
    input.setAttribute('aria-invalid', String(state.problem !== '' && state.focus === 'code'));
    return [
      el('h1', { tabindex: '-1' }, 'Enter your code'),
      node,
      el(
        'div',
        { class: 'actions' },
        button('Send a new code', 'secondary', 'resend', () => sendSignInCode(state.codeSentTo ?? state.email)),
        button('Use a different email', 'ghost', 'change-email', () => {
          state.codeSentTo = null;
          state.problem = '';
          state.notice = '';
          state.focus = 'email';
          render();
        }),
      ),
      el('p', { class: 'note' }, 'No code? Check your spam folder, or create an account in the Tableside app.'),
    ];
  };

  // ---- Confirm it's you ----------------------------------------------------

  const sendConfirmCode = (then: Action | null) =>
    run(async () => {
      const result = await account.confirm.requestCode();
      if (result.status !== 'sent') {
        state.problem = codeProblem(result);
        state.confirming = { codeSent: false, then };
        return;
      }
      state.confirming = { codeSent: true, then };
      state.notice = "We've emailed you a code.";
      state.focus = 'confirm-code';
    });

  const confirmWithCode = (code: string) =>
    run(async () => {
      if (!/^\d{6}$/.test(code.trim())) {
        state.problem = 'Enter the 6-digit code from the email.';
        state.focus = 'confirm-code';
        return;
      }
      const result = await account.confirm.withCode(code);
      if (result.status === 'invalid-code') {
        state.problem = INVALID_CODE;
        state.focus = 'confirm-code';
        return;
      }
      if (result.status !== 'confirmed') {
        state.problem = "Couldn't confirm it's you. Check your connection and try again.";
        state.focus = 'confirm-code';
        return;
      }
      const then = state.confirming?.then ?? null;
      state.confirmed = true;
      state.confirming = null;
      state.notice = 'Confirmed.';
      if (then) await act(then);
    });

  /** Asks the player to confirm it's them, then runs `then`. */
  const confirmPanel = (then: Action | null) => {
    if (!state.confirming?.codeSent) {
      return [
        el('p', {}, "First, confirm it's you: we'll email a code to your sign-in address."),
        el('div', { class: 'actions' }, button("Confirm it's you", 'primary', 'confirm', () => sendConfirmCode(then))),
      ];
    }
    const { node, input } = form(
      { id: 'confirm-code', label: 'Code', hint: 'Enter the 6-digit code we just emailed you.', attributes: { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', pattern: '[0-9]{6}' } },
      'Confirm',
      confirmWithCode,
    );
    input.setAttribute('aria-invalid', String(state.problem !== '' && state.focus === 'confirm-code'));
    return [
      el('h2', {}, "Confirm it's you"),
      node,
      el('div', { class: 'actions' }, button('Send a new code', 'secondary', 'confirm-resend', () => sendConfirmCode(state.confirming?.then ?? then))),
    ];
  };

  // ---- Deletion actions ----------------------------------------------------

  /** Runs a deletion action; one that needs Confirm it's you asks for it, then runs again. */
  const act = async (action: Action) => {
    const result = action === 'schedule' ? await account.schedule() : action === 'cancel' ? await account.cancel() : await account.deletePermanently();
    if (result.status === 'fresh-authentication-required') {
      state.confirmed = false;
      state.confirming = { codeSent: false, then: action };
      state.focus = 'confirm';
      return;
    }
    state.permanent = false;
    if (result.status === 'scheduled') state.notice = `Deletion is scheduled for ${dayText(result.deadline)}.`;
    else if (result.status === 'canceled') state.notice = 'Deletion is canceled. Your account is open again.';
    else if (result.status === 'deleted') state.notice = 'Your account was deleted.';
    else if (result.status === 'too-late') state.problem = CANCEL_TOO_LATE;
    else state.problem = action === 'schedule' ? SCHEDULE_UNKNOWN : action === 'cancel' ? CANCEL_FAILED : DELETION_UNKNOWN;
  };

  const permanentWarnings = () => [
    el('h2', {}, 'If you delete permanently now'),
    el(
      'ul',
      { class: 'rows' },
      row("Records that haven't synced are lost", "Anything on your devices that hasn't reached your account is erased with it, and can't be recovered."),
      row('Shown as "Deleted author"', 'Your profile and strategy descriptions are removed. Strategies others saved or remixed keep working, credited to "Deleted author".'),
      row(
        'Paid time is forfeited',
        "Any subscription time left is lost. Deleting doesn't cancel the subscription: cancel it in the App Store or Google Play so you aren't charged again.",
      ),
      row("There's no undo", "Your account and its data are erased within seven days, and the account can't come back."),
    ),
    el(
      'div',
      { class: 'actions' },
      button('Delete permanently now', 'primary', 'delete-confirmed', () => run(() => act('delete'))),
      button('Keep my account', 'ghost', 'keep', () => {
        state.permanent = false;
        state.focus = 'delete';
        render();
      }),
    ),
  ];

  const showPermanent = () => {
    state.permanent = true;
    state.focus = 'delete-confirmed';
    render();
  };

  const signOutButton = () =>
    el(
      'div',
      { class: 'actions' },
      button('Sign out', 'ghost', 'sign-out', () =>
        run(async () => {
          await account.signOut();
          state.confirmed = false;
          state.confirming = null;
          state.permanent = false;
          state.notice = 'Signed out.';
        }),
      ),
    );

  const activeView = (email: string) => {
    const choices = state.confirmed
      ? [
          el('h2', {}, 'Before you go'),
          el(
            'ul',
            { class: 'rows' },
            row('Export my data first', "In the app: More → Settings → Account → Export my data. Deletion doesn't wait for it."),
          ),
          ...billingHelp(),
          el('h2', {}, 'If you schedule deletion'),
          el(
            'ul',
            { class: 'rows' },
            row('Access locks now', 'Practice and your account lock now, and on your devices once they connect.'),
            row('Public content is hidden', 'Your profile, strategies, ratings and contributions are hidden at once.'),
            row('Your data is kept', 'Nothing is deleted for 30 days. Sign in and choose Cancel deletion to keep your account.'),
            row('Billing continues', "Your subscription isn't canceled. Cancel it in the App Store or Google Play if you don't want to be charged."),
          ),
          el('div', { class: 'actions' }, button('Schedule deletion', 'primary', 'schedule', () => run(() => act('schedule')))),
          el('p', { class: 'note' }, 'You have 30 days to change your mind.'),
          ...(state.permanent
            ? permanentWarnings()
            : [el('div', { class: 'actions' }, button('Delete permanently now', 'ghost', 'delete', showPermanent))]),
        ]
      : confirmPanel(state.confirming?.then ?? null);
    return [el('h1', { tabindex: '-1' }, 'Delete your account'), el('p', { class: 'lead' }, `Signed in as ${email}.`), ...choices, signOutButton()];
  };

  const scheduledView = (email: string, deadline: number) => [
    el('h1', { tabindex: '-1' }, 'Your account is scheduled for deletion'),
    el(
      'p',
      { class: 'lead' },
      `It will be deleted permanently on ${dayText(deadline)}. Until then, practice and your account are locked, your public content is hidden, and your data is kept.`,
    ),
    el('p', { class: 'note' }, `Signed in as ${email}.`),
    el('h2', {}, 'Deletion status'),
    el('ul', { class: 'rows' }, row('Deletion', scheduledDetail(deadline))),
    ...(state.confirming
      ? confirmPanel(state.confirming.then)
      : [
          el(
            'div',
            { class: 'actions' },
            button('Cancel deletion', 'primary', 'cancel', () => run(() => act('cancel'))),
            ...(state.permanent ? [] : [button('Delete permanently now', 'ghost', 'delete', showPermanent)]),
          ),
          ...(state.permanent ? permanentWarnings() : []),
        ]),
    ...billingHelp(),
    signOutButton(),
  ];

  const unknownStatusView = (email: string) => [
    el('h1', { tabindex: '-1' }, 'Your account'),
    el('p', { class: 'lead' }, `Signed in as ${email}.`),
    el('p', {}, "Couldn't check your account's deletion status. Check your connection and try again."),
    el('div', { class: 'actions' }, button('Try again', 'primary', 'retry', () => run(async () => void (await account.refresh())))),
    signOutButton(),
  ];

  const deletedBody = (progress: DeletionProgress | null) => {
    if (!progress) return 'Its data is being erased from Tableside.';
    if (progress.status === 'completed' && progress.completedAt !== null) return `Its data was erased from Tableside on ${dayText(progress.completedAt)}.`;
    return `Its data is being erased from Tableside, by ${dayText(progress.cleanupBy)}.`;
  };

  const deletedView = (progress: DeletionProgress | null) => [
    el('h1', { tabindex: '-1' }, 'Your account was deleted'),
    el('p', { class: 'lead' }, deletedBody(progress)),
    el('h2', {}, 'Deletion status'),
    el(
      'ul',
      { class: 'rows' },
      row('Deletion', deletionDetail(progress)),
      row('Analytics data', analyticsDetail(progress)),
      row('Backups', BACKUPS_DETAIL),
      progress?.providers === 'not-held' ? row('Apple or Google sign-in', PROVIDER_GRANT_DETAIL) : null,
    ),
    el(
      'div',
      { class: 'actions' },
      button('Check again', 'secondary', 'check', () => run(async () => void (await account.refresh()))),
      button('Done', 'primary', 'done', () =>
        run(async () => {
          await account.dismiss();
          state.email = '';
          state.focus = 'email';
        }),
      ),
    ),
    el('p', { class: 'note' }, 'Done forgets this deletion in this browser. Signing up again later is a new account.'),
    ...billingHelp(),
  ];

  const viewFor = (view: WebAccountView | null): { key: string; nodes: (Node | null)[] } => {
    if (!view) return { key: 'loading', nodes: [el('h1', { tabindex: '-1' }, 'Your Tableside account'), el('p', {}, 'Checking your account…')] };
    if (view.state === 'signed-out') return { key: state.codeSentTo === null ? 'sign-in' : 'code', nodes: signedOutView() };
    if (view.state === 'deleted') return { key: 'deleted', nodes: deletedView(view.progress) };
    if (view.deletion === null) return { key: 'unknown', nodes: unknownStatusView(view.email) };
    if (view.deletion.status === 'scheduled') return { key: 'scheduled', nodes: scheduledView(view.email, view.deletion.deadline) };
    return { key: 'active', nodes: activeView(view.email) };
  };

  let started = false;
  function render() {
    const { key, nodes } = viewFor(started ? account.view : null);
    content.replaceChildren(...nodes.filter((node): node is Node => node !== null));
    status.textContent = state.notice;
    alert.textContent = state.problem;
    main.setAttribute('aria-busy', String(state.busy));
    if (state.busy) return;
    const target = state.focus;
    state.focus = null;
    if (key !== screen) {
      screen = key;
      doc.title = `${content.querySelector('h1')?.textContent ?? 'Your account'} · Tableside`;
      // A new view: its field when it asks for one, otherwise its heading.
      const field = target ? content.querySelector<HTMLElement>(`[data-focus="${target}"]`) : null;
      (field ?? content.querySelector<HTMLElement>('h1'))?.focus();
      return;
    }
    const find = (key: string | null | undefined) => (key ? content.querySelector<HTMLElement>(`[data-focus="${key}"]`) : null);
    const next = find(target) ?? find(lastFocus);
    if (next) next.focus();
    // The control that had focus is gone (a step finished): the heading takes it, so focus is never lost to the page.
    else if (!content.contains(doc.activeElement)) content.querySelector<HTMLElement>('h1')?.focus();
  }

  main.replaceChildren(content, status, alert, supportLinks());
  render();
  return account.start().then(
    () => {
      started = true;
      render();
    },
    () => {
      started = true;
      state.problem = NEEDS_CONNECTION;
      render();
    },
  );
}
