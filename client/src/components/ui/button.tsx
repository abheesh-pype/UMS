import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { subscribeToOperationRequests } from "@/lib/operationTracker"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "premium-gradient text-white shadow-md hover:shadow-lg hover:brightness-110",
        glass: "glass text-foreground shadow-sm hover:bg-white/20 dark:hover:bg-black/20",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-lg px-8 text-base has-[>svg]:px-6",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  disabled = false,
  onClick,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const buttonType = type ?? "submit"
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const lockedRef = React.useRef(false)
  const [busy, setBusy] = React.useState(false)

  const runOperation = React.useCallback(async (operation?: () => unknown, waitForRequest = false) => {
    if (lockedRef.current) return
    lockedRef.current = true
    const activeRequests = new Set<string>()
    let sawRequest = false
    let resolveRequestStarted: (() => void) | undefined
    let resolveRequestsFinished: (() => void) | undefined
    const requestStarted = new Promise<void>(resolve => {
      resolveRequestStarted = resolve
    })
    let requestsFinished = Promise.resolve()

    const unsubscribe = subscribeToOperationRequests(event => {
      if (event.type === 'start') {
        sawRequest = true
        activeRequests.add(event.id)
        resolveRequestStarted?.()
        requestsFinished = new Promise<void>(resolve => {
          resolveRequestsFinished = resolve
        })
      } else {
        activeRequests.delete(event.id)
        if (sawRequest && activeRequests.size === 0) resolveRequestsFinished?.()
      }
    })

    try {
      const result = operation?.()
      const isPromise = result !== null
        && (typeof result === 'object' || typeof result === 'function')
        && typeof (result as PromiseLike<unknown>).then === 'function'

      if (waitForRequest || isPromise) setBusy(true)
      if (isPromise) await result

      if (waitForRequest) {
        await Promise.race([requestStarted, new Promise<void>(resolve => window.setTimeout(resolve, 500))])
      } else if (!isPromise) {
        await new Promise<void>(resolve => window.setTimeout(resolve, 0))
      }

      if (sawRequest && activeRequests.size > 0) await requestsFinished
    } finally {
      unsubscribe()
      lockedRef.current = false
      setBusy(false)
    }
  }, [])

  React.useEffect(() => {
    if (asChild || buttonType !== "submit") return
    const button = buttonRef.current
    const form = button?.form
    if (!button || !form) return

    const handleSubmit = (event: SubmitEvent) => {
      const defaultSubmitter = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])')
      if (event.submitter === button || (!event.submitter && defaultSubmitter === button)) {
        void runOperation(undefined, true)
      }
    }

    form.addEventListener("submit", handleSubmit)
    return () => form.removeEventListener("submit", handleSubmit)
  }, [asChild, buttonType, runOperation])

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = event => {
    if (lockedRef.current || disabled) {
      event.preventDefault()
      return
    }
    if (!onClick || asChild) {
      onClick?.(event)
      return
    }
    void runOperation(() => onClick(event), buttonType === "submit")
  }

  return (
    <Comp
      ref={buttonRef}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      type={type}
      disabled={disabled || busy}
      onClick={handleClick}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
