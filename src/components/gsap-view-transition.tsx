"use client"

import { useRef, type ReactNode } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP)

type TransitionVariant = "content" | "sidebar"

type TransitionProfile = {
  duration: number
  ease: string
  opacity: number
  x: number
  y: number
}

type GsapViewTransitionProps = {
  animateOnInitial?: boolean
  children: ReactNode
  className?: string
  surfaceClassName?: string
  variant?: TransitionVariant
  view: string
}

const CONTENT_VIEW_ORDER = [
  "dashboard",
  "usage",
  "api-keys",
  "model-square",
  "request-logs",
  "sandbox-list",
  "sandbox-templates",
  "chat",
]

function directionForView(view: string, previousView: string | null) {
  if (!previousView) {
    return 0
  }

  const previousIndex = CONTENT_VIEW_ORDER.indexOf(previousView)
  const nextIndex = CONTENT_VIEW_ORDER.indexOf(view)

  if (previousIndex < 0 || nextIndex < 0 || previousIndex === nextIndex) {
    return 0
  }

  return nextIndex > previousIndex ? 1 : -1
}

function profileForView(
  view: string,
  variant: TransitionVariant,
  previousView: string | null
): TransitionProfile {
  if (variant === "sidebar") {
    return {
      duration: 0.2,
      ease: "power3.out",
      opacity: 0.84,
      x: 0,
      y: view === "chat-history" ? 4 : 2,
    }
  }

  const direction = directionForView(view, previousView)

  if (view === "chat") {
    return {
      duration: 0.34,
      ease: "power3.out",
      opacity: 0.94,
      x: 6,
      y: 0,
    }
  }

  if (view === "model-square") {
    return {
      duration: 0.32,
      ease: "power3.out",
      opacity: 0.94,
      x: 0,
      y: 4,
    }
  }

  if (view === "request-logs") {
    return {
      duration: 0.3,
      ease: "power3.out",
      opacity: 0.94,
      x: direction < 0 ? -3 : 0,
      y: 4,
    }
  }

  return {
    duration: 0.31,
    ease: "power3.out",
    opacity: 0.94,
    x: direction < 0 ? -4 : 0,
    y: 4,
  }
}

function resetElement(element: HTMLElement) {
  gsap.set(element, {
    autoAlpha: 1,
    clearProps: "opacity,transform,visibility,willChange",
    x: 0,
    y: 0,
  })
}

function layerTargetsForView(
  surface: HTMLElement,
  view: string,
  variant: TransitionVariant
) {
  if (variant !== "content" || view === "chat") {
    return []
  }

  const firstChild = surface.firstElementChild
  const parent = firstChild instanceof HTMLElement ? firstChild : surface

  return Array.from(parent.children)
    .slice(0, 5)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
}

export function GsapViewTransition({
  animateOnInitial = true,
  children,
  className,
  surfaceClassName,
  variant = "content",
  view,
}: GsapViewTransitionProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const previousViewRef = useRef<string | null>(null)

  useGSAP(
    () => {
      const root = rootRef.current
      const surface = surfaceRef.current

      if (!root || !surface) {
        return
      }

      const shouldReduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches

      const layerTargets = layerTargetsForView(surface, view, variant)

      gsap.killTweensOf(surface)
      if (layerTargets.length) {
        gsap.killTweensOf(layerTargets)
      }

      const previousView = previousViewRef.current
      previousViewRef.current = view
      const shouldAnimate = previousView
        ? previousView !== view
        : animateOnInitial

      if (shouldReduceMotion || !shouldAnimate) {
        root.removeAttribute("data-view-transitioning")
        resetElement(surface)
        layerTargets.forEach(resetElement)
        return
      }

      const profile = profileForView(view, variant, previousView)
      root.setAttribute("data-view-transitioning", "true")

      const timeline = gsap.timeline({
        defaults: {
          ease: profile.ease,
        },
        onComplete: () => {
          root.removeAttribute("data-view-transitioning")
        },
      })

      timeline.fromTo(
        surface,
        {
          autoAlpha: profile.opacity,
          willChange: "opacity, transform",
          x: profile.x,
          y: profile.y,
        },
        {
          autoAlpha: 1,
          clearProps: "opacity,transform,visibility,willChange",
          duration: profile.duration,
          x: 0,
          y: 0,
        }
      )

      if (layerTargets.length > 1) {
        timeline.fromTo(
          layerTargets,
          {
            autoAlpha: 0.96,
            willChange: "opacity, transform",
            y: 3,
          },
          {
            autoAlpha: 1,
            clearProps: "opacity,transform,visibility,willChange",
            duration: 0.22,
            stagger: 0.018,
            y: 0,
          },
          0.04
        )
      }

      return () => {
        root.removeAttribute("data-view-transitioning")
        timeline.kill()
        resetElement(surface)
        layerTargets.forEach(resetElement)
      }
    },
    {
      dependencies: [animateOnInitial, variant, view],
      scope: rootRef,
      revertOnUpdate: true,
    }
  )

  return (
    <div ref={rootRef} className={cn("min-h-0", className)}>
      <div ref={surfaceRef} className={cn(surfaceClassName ?? "min-h-full")}>
        {children}
      </div>
    </div>
  )
}
