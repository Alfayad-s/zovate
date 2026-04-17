/** Public filenames with spaces/special chars — encode per segment for safe URLs. */
export function authAssetUrl(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return `/${parts.map(encodeURIComponent).join("/")}`;
}

export const AUTH_MEDIA = {
  videoDesignSystems:
    "/videos/From KlickPin CF Design Systems Streamline Your UI Workflow Like a Pro | Web design Ui design Web app design - Pin-1688918606909088.mp4",
  videoPacking:
    "/videos/From KlickPin CF Discover Stylish packing list ideas that feel fresh practical and surprisingly easy to try for a polished look people will notice - Pin-1196337405351406.mp4",
  videoAiMotion:
    "/videos/From KlickPin CF Pin by Abdus - UI UX Designer on 3D Animated Elements | Motion graphics design Motion design animation Motion design - Pin-832391943656762913.mp4",
  imageB2b:
    "/images/B2B Sales Development Services | Belkins Agency.jpg",
} as const;

/** One headline = ordered segments; `accent` uses brand orange for emphasis */
export type HeadlineSegment = { text: string; accent?: boolean };

export type AuthSlide =
  | {
      kind: "video";
      src: string;
      label: string;
      headline: HeadlineSegment[];
    }
  | {
      kind: "image";
      src: string;
      label: string;
      headline: HeadlineSegment[];
    };

export const AUTH_SLIDES: AuthSlide[] = [
  {
    kind: "video",
    src: authAssetUrl(AUTH_MEDIA.videoDesignSystems),
    label: "Design systems",
    headline: [
      { text: "Streamline your " },
      { text: "UI workflow", accent: true },
      { text: " like a pro." },
    ],
  },
  {
    kind: "video",
    src: authAssetUrl(AUTH_MEDIA.videoPacking),
    label: "Ideas & workflow",
    headline: [
      { text: "Fresh ideas", accent: true },
      { text: " that are practical and easy to ship." },
    ],
  },
  {
    kind: "video",
    src: authAssetUrl(AUTH_MEDIA.videoAiMotion),
    label: "AI & motion",
    headline: [
      { text: "Your " },
      { text: "AI-integrated task manager", accent: true },
      { text: " clear priorities, less busywork." },
    ],
  },
  {
    kind: "image",
    src: authAssetUrl(AUTH_MEDIA.imageB2b),
    label: "Grow with clarity",
    headline: [
      { text: "Build pipeline with " },
      { text: "clarity and momentum", accent: true },
      { text: "." },
    ],
  },
];

export function headlinePlainText(segments: HeadlineSegment[]): string {
  return segments.map((s) => s.text).join("");
}
