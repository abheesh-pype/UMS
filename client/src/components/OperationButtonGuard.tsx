import { useEffect } from 'react';
import { subscribeToOperationRequests } from '@/lib/operationTracker';

type PendingButton = HTMLButtonElement & {
  __operationGuard?: {
    wasDisabled: boolean;
    activeRequests: Set<string>;
    sawRequest: boolean;
  };
};

export function OperationButtonGuard() {
  useEffect(() => {
    const watchButton = (button: HTMLButtonElement | null) => {
      if (!button || button.disabled || button.dataset.slot === 'button' || (button as PendingButton).__operationGuard) return;

      const target = button as PendingButton;
      const guard = {
        wasDisabled: button.disabled,
        activeRequests: new Set<string>(),
        sawRequest: false
      };
      target.__operationGuard = guard;

      const unsubscribe = subscribeToOperationRequests(event => {
        if (target.__operationGuard !== guard) return;

        if (event.type === 'start') {
          guard.sawRequest = true;
          guard.activeRequests.add(event.id);
          button.disabled = true;
          button.dataset.operationPending = 'true';
        } else {
          guard.activeRequests.delete(event.id);
          if (guard.sawRequest && guard.activeRequests.size === 0) {
            button.disabled = guard.wasDisabled;
            delete button.dataset.operationPending;
            delete target.__operationGuard;
            unsubscribe();
          }
        }
      });

      window.setTimeout(() => {
        if (target.__operationGuard !== guard || guard.sawRequest) return;
        delete target.__operationGuard;
        unsubscribe();
      }, 500);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element) {
        watchButton(target.closest('button'));
      }
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const submitter = event.submitter;
      const button = submitter instanceof HTMLButtonElement
        ? submitter
        : form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
      watchButton(button);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit, true);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('submit', handleSubmit, true);
    };
  }, []);

  return null;
}
