import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ExternalLink, LockOpen } from "lucide-react";
import type { ChangeEvent, ComponentProps, KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { env } from "@/env.ts";
import { $api } from "@/lib/api/client.ts";
import { ModelSelector } from "./ModelSelector.tsx";

const routeApi = getRouteApi("/");

function SidebarPanelIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden={true}
    >
      <title>Sidebar panel</title>
      <path
        d="M16.6667 14.9997C17.1269 14.9997 17.5 15.3728 17.5 15.833C17.5 16.2932 17.1269 16.6663 16.6667 16.6663H3.33333C2.8731 16.6663 2.5 16.2932 2.5 15.833C2.5 15.3728 2.8731 14.9997 3.33333 14.9997H16.6667ZM16.6667 9.16634C17.1269 9.16634 17.5 9.53944 17.5 9.99967C17.5 10.4599 17.1269 10.833 16.6667 10.833H3.33333C2.8731 10.833 2.5 10.4599 2.5 9.99967C2.5 9.53944 2.8731 9.16634 3.33333 9.16634H16.6667ZM16.6667 3.33301C17.1269 3.33301 17.5 3.7061 17.5 4.16634C17.5 4.62658 17.1269 4.99967 16.6667 4.99967H3.33333C2.8731 4.99967 2.5 4.62658 2.5 4.16634C2.5 3.7061 2.8731 3.33301 3.33333 3.33301H16.6667Z"
        fill="black"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden={true}
    >
      <title>Plus</title>
      <path
        d="M9.16634 15.833V10.833H4.16634C3.7061 10.833 3.33301 10.4599 3.33301 9.99967C3.33301 9.53944 3.7061 9.16634 4.16634 9.16634H9.16634V4.16634C9.16634 3.7061 9.53944 3.33301 9.99967 3.33301C10.4599 3.33301 10.833 3.7061 10.833 4.16634V9.16634H15.833C16.2932 9.16634 16.6663 9.53944 16.6663 9.99967C16.6663 10.4599 16.2932 10.833 15.833 10.833H10.833V15.833C10.833 16.2932 10.4599 16.6663 9.99967 16.6663C9.53944 16.6663 9.16634 16.2932 9.16634 15.833Z"
        fill="black"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden={true}
    >
      <title>Search</title>
      <path
        d="M15.0003 9.16699C15.0003 5.94533 12.3887 3.33366 9.16699 3.33366C5.94533 3.33366 3.33366 5.94533 3.33366 9.16699C3.33366 12.3887 5.94533 15.0003 9.16699 15.0003C12.3887 15.0003 15.0003 12.3887 15.0003 9.16699ZM16.667 9.16699C16.667 10.9378 16.0519 12.5641 15.0256 13.8472L18.0895 16.9111C18.4149 17.2366 18.4149 17.7641 18.0895 18.0895C17.7641 18.4149 17.2366 18.4149 16.9111 18.0895L13.8472 15.0256C12.5641 16.0519 10.9378 16.667 9.16699 16.667C5.02486 16.667 1.66699 13.3091 1.66699 9.16699C1.66699 5.02486 5.02486 1.66699 9.16699 1.66699C13.3091 1.66699 16.667 5.02486 16.667 9.16699Z"
        fill="black"
      />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden={true}
    >
      <title>Pin</title>
      <path
        d="M14.1663 3.33301C14.1663 3.11199 14.0785 2.9001 13.9222 2.74382C13.7659 2.58753 13.554 2.49967 13.333 2.49967H6.66634C6.44533 2.49967 6.23343 2.58753 6.07715 2.74382C5.92087 2.9001 5.83301 3.11199 5.83301 3.33301C5.83301 3.55402 5.92087 3.76592 6.07715 3.9222C6.21393 4.05899 6.39331 4.14336 6.58415 4.16227L6.83073 4.17448C7.21239 4.2123 7.57116 4.38105 7.84473 4.65462C8.15729 4.96718 8.33301 5.39098 8.33301 5.83301V8.96696C8.33273 9.43194 8.20287 9.88769 7.95784 10.2829C7.71364 10.6767 7.36404 10.9938 6.94954 11.2008L6.95036 11.2017L5.46761 11.952L5.46191 11.9544C5.32327 12.0234 5.20665 12.1297 5.125 12.2612C5.04334 12.3929 4.9998 12.5449 4.99967 12.6999V13.333H14.9997V12.6999C14.9995 12.5449 14.956 12.3929 14.8743 12.2612C14.7927 12.1297 14.6761 12.0234 14.5374 11.9544L14.5317 11.952L13.049 11.2017V11.2008C12.6348 10.9938 12.2856 10.6765 12.0415 10.2829C11.7965 9.88769 11.6666 9.43194 11.6663 8.96696V5.83301C11.6663 5.39098 11.8421 4.96718 12.1546 4.65462C12.4282 4.38105 12.787 4.2123 13.1686 4.17448L13.4152 4.16227C13.606 4.14336 13.7854 4.05899 13.9222 3.9222C14.0785 3.76592 14.1663 3.55402 14.1663 3.33301ZM15.833 3.33301C15.833 3.99605 15.5694 4.63175 15.1006 5.10059C14.6317 5.56943 13.996 5.83301 13.333 5.83301V8.96615L13.3411 9.08171C13.3572 9.19588 13.3971 9.30608 13.4583 9.40479C13.54 9.53636 13.6566 9.64263 13.7952 9.71159L13.8009 9.71403L15.2788 10.4619L15.4318 10.5449C15.7812 10.75 16.0767 11.0373 16.2912 11.3831C16.5362 11.7783 16.6661 12.2341 16.6663 12.6991V13.333C16.6663 13.775 16.4906 14.1988 16.1781 14.5114C15.8655 14.824 15.4417 14.9997 14.9997 14.9997H10.833V18.333C10.833 18.7932 10.4599 19.1663 9.99967 19.1663C9.53944 19.1663 9.16634 18.7932 9.16634 18.333V14.9997H4.99967C4.55765 14.9997 4.13385 14.824 3.82129 14.5114C3.50873 14.1988 3.33301 13.775 3.33301 13.333V12.6991L3.33952 12.5257C3.36786 12.1214 3.4937 11.7291 3.70817 11.3831C3.95328 10.9879 4.30404 10.6689 4.72054 10.4619L6.1984 9.71403L6.2041 9.71159C6.34275 9.64263 6.45937 9.53637 6.54102 9.40479C6.60223 9.30608 6.64212 9.19588 6.6582 9.08171L6.66634 8.96615V5.83301C6.0033 5.83301 5.3676 5.56943 4.89876 5.10059C4.42992 4.63175 4.16634 3.99605 4.16634 3.33301C4.16634 2.66997 4.42992 2.03427 4.89876 1.56543C5.3676 1.09659 6.0033 0.833008 6.66634 0.833008H13.333C13.996 0.833008 14.6317 1.09659 15.1006 1.56543C15.5694 2.03427 15.833 2.66997 15.833 3.33301Z"
        fill="black"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden={true}
    >
      <title>Send</title>
      <g clip-path="url(#clip0_394_3547)">
        <path
          d="M14.0091 0.720879C14.1621 0.667504 14.3254 0.65208 14.485 0.675957L14.5547 0.688978L14.6231 0.706556C14.7587 0.747076 14.884 0.816276 14.9909 0.90903L15.043 0.957207L15.0912 1.00864C15.1838 1.11548 15.2525 1.24098 15.293 1.37648L15.3112 1.44549L15.3242 1.51515C15.348 1.67441 15.3318 1.83713 15.2787 1.98976L15.2793 1.99041L10.946 14.6571V14.6577C10.8798 14.8506 10.7562 15.0188 10.5918 15.1395C10.4273 15.2602 10.2294 15.3276 10.0254 15.3329C9.82154 15.3381 9.62092 15.2808 9.45052 15.1688C9.28006 15.0567 9.1476 14.8946 9.07162 14.7053L6.95183 9.41814L6.92383 9.35695C6.8926 9.29751 6.85238 9.24312 6.80469 9.19549C6.741 9.13191 6.66493 9.08181 6.58138 9.04835V9.0477L1.29427 6.92791C1.10501 6.85197 0.9435 6.71999 0.831383 6.54965C0.719257 6.37918 0.662096 6.17811 0.667321 5.97413C0.672571 5.77021 0.739999 5.57285 0.86068 5.40838L0.907555 5.34848C1.02326 5.21364 1.17352 5.11214 1.34245 5.05421V5.05356L14.0091 0.720228V0.720879ZM8.13737 8.80356C8.15569 8.84182 8.17292 8.88064 8.18881 8.9201L8.18946 8.9214L9.97461 13.3752L13.3066 3.63494L8.13737 8.80356ZM2.6237 6.02426L7.07618 7.81007H7.07683C7.1165 7.82596 7.15554 7.84382 7.19401 7.86215L12.3646 2.69158L2.6237 6.02426Z"
          fill="black"
        />
      </g>
      <defs>
        <clipPath id="clip0_394_3547">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={14}
      height={15}
      viewBox="0 0 14 15"
      fill="none"
      aria-hidden={true}
    >
      <title>Settings</title>
      <path
        d="M10.6263 7.32161C10.6263 6.96402 10.7126 6.61154 10.8776 6.29427C11.0426 5.97702 11.2815 5.70408 11.5742 5.4987C11.7516 5.36959 11.8755 5.17948 11.9219 4.96484C11.9687 4.74809 11.9331 4.52147 11.8223 4.32943C11.7113 4.13745 11.5327 3.99358 11.3216 3.92578C11.1104 3.85803 10.881 3.87118 10.679 3.96289C10.3565 4.11198 10.0029 4.18151 9.64778 4.16602C9.29047 4.1504 8.94195 4.04915 8.63215 3.87044C8.32239 3.69172 8.0602 3.4408 7.86783 3.13932C7.67549 2.83782 7.55823 2.49426 7.52668 2.13802V2.13737C7.50463 1.91789 7.40219 1.71424 7.23892 1.56576C7.0745 1.41623 6.86025 1.33336 6.63801 1.33333C6.41579 1.33333 6.20153 1.41628 6.0371 1.56576C5.8727 1.71527 5.76977 1.92071 5.74869 2.14193C5.74658 2.16416 5.74312 2.18621 5.73892 2.20768C5.69904 2.53889 5.58663 2.85757 5.40689 3.13932C5.21452 3.44084 4.95235 3.6917 4.64257 3.87044C4.33275 4.0492 3.98429 4.15038 3.62694 4.16602C3.26958 4.18164 2.91344 4.11133 2.58918 3.96029V3.95964C2.38898 3.87112 2.16298 3.8594 1.95442 3.92643C1.74347 3.99426 1.56528 4.13823 1.45442 4.33008C1.34356 4.52204 1.3081 4.7488 1.35481 4.96549C1.40157 5.18205 1.52703 5.37342 1.70702 5.5026H1.70637C1.99665 5.70756 2.23382 5.97894 2.39778 6.29427C2.56272 6.61152 2.64908 6.96405 2.64908 7.32161C2.64904 7.67905 2.56263 8.03116 2.39778 8.34831C2.23376 8.66377 1.99616 8.93499 1.70572 9.13997L1.70637 9.14063C1.52621 9.26975 1.40037 9.46109 1.35351 9.67773C1.30668 9.89458 1.34214 10.1217 1.45312 10.3138C1.5641 10.5058 1.74261 10.6497 1.95377 10.7174C2.16489 10.7852 2.39378 10.7719 2.59569 10.6803C2.91842 10.531 3.27224 10.4611 3.6276 10.4766C3.985 10.4921 4.33332 10.5934 4.64322 10.7721C4.95315 10.9509 5.21576 11.2016 5.40819 11.5033C5.59982 11.8037 5.716 12.1458 5.74804 12.5007H5.74869C5.76973 12.7219 5.87265 12.9273 6.0371 13.0768C6.20155 13.2264 6.41574 13.3092 6.63801 13.3092C6.86026 13.3092 7.0745 13.2264 7.23892 13.0768C7.40333 12.9273 7.5063 12.7219 7.52733 12.5007C7.55941 12.1459 7.67627 11.8042 7.86783 11.5039C8.0602 11.2023 8.32233 10.9516 8.63215 10.7728C8.94199 10.594 9.29041 10.4922 9.64778 10.4766C10.0029 10.4611 10.3564 10.5312 10.679 10.6803L10.7558 10.7109C10.9379 10.774 11.1367 10.7767 11.3216 10.7174C11.5327 10.6497 11.7113 10.5058 11.8223 10.3138C11.9332 10.1217 11.9687 9.89458 11.9219 9.67773C11.875 9.46113 11.7491 9.26976 11.569 9.14063V9.13997C11.2787 8.93501 11.0416 8.66367 10.8776 8.34831C10.7127 8.03114 10.6263 7.67909 10.6263 7.32161ZM7.97069 7.32161C7.97061 6.58531 7.37369 5.98828 6.63736 5.98828C5.90111 5.98837 5.30412 6.58536 5.30403 7.32161C5.30403 8.05794 5.90106 8.65486 6.63736 8.65495C7.37374 8.65495 7.97069 8.05799 7.97069 7.32161ZM9.30403 7.32161C9.30403 8.79437 8.11012 9.98828 6.63736 9.98828C5.16468 9.98819 3.97069 8.79432 3.97069 7.32161C3.97078 5.84898 5.16473 4.65504 6.63736 4.65495C8.11007 4.65495 9.30394 5.84893 9.30403 7.32161ZM11.9596 7.32161C11.9597 7.465 11.9944 7.6065 12.0605 7.73372C12.1101 7.82902 12.1764 7.91425 12.2558 7.98568L12.3398 8.05273L12.345 8.05664C12.7945 8.37862 13.1085 8.85605 13.2253 9.39648C13.342 9.93696 13.2531 10.5017 12.9766 10.9805C12.6999 11.4593 12.255 11.8181 11.7285 11.987C11.202 12.1558 10.6317 12.1224 10.1282 11.8939L10.1217 11.8913C9.99172 11.8308 9.84899 11.8023 9.70572 11.8086C9.56238 11.8149 9.42245 11.8554 9.29817 11.9271C9.17388 11.9988 9.0687 12.0997 8.99153 12.2207C8.91438 12.3417 8.86745 12.4795 8.85481 12.6224V12.627C8.80236 13.1784 8.54585 13.6904 8.13606 14.0632C7.72618 14.4359 7.19204 14.6425 6.63801 14.6426C6.08394 14.6426 5.54987 14.4359 5.13996 14.0632C4.7301 13.6904 4.47368 13.1785 4.42121 12.627L4.42056 12.6224C4.40795 12.4794 4.36102 12.3417 4.28385 12.2207C4.20664 12.0997 4.10156 11.9988 3.9772 11.9271C3.85286 11.8554 3.71307 11.8148 3.56965 11.8086C3.42632 11.8024 3.28367 11.8307 3.15364 11.8913L3.14713 11.8939C2.64372 12.1224 2.07332 12.1558 1.54687 11.987C1.02037 11.8181 0.575433 11.4592 0.298819 10.9805C0.022209 10.5017 -0.066584 9.93697 0.0501214 9.39648C0.166849 8.85605 0.480847 8.37861 0.93033 8.05664L0.935538 8.05273C1.05287 7.97038 1.14868 7.8609 1.21483 7.73372C1.28098 7.60651 1.31571 7.465 1.31575 7.32161C1.31575 7.17822 1.28095 7.03674 1.21483 6.90951C1.14866 6.78223 1.05296 6.67224 0.935538 6.58984L0.929679 6.58594C0.480791 6.26378 0.167847 5.78622 0.0514234 5.24609C-0.0649931 4.70598 0.023163 4.14188 0.29947 3.66341C0.575782 3.18494 1.02021 2.82603 1.54621 2.6569C2.00634 2.50897 2.50033 2.51549 2.95377 2.67188L3.14582 2.74805L3.15233 2.7513C3.28234 2.81186 3.42507 2.8402 3.56835 2.83398C3.71166 2.82772 3.85164 2.78715 3.9759 2.71549C4.10021 2.64377 4.20536 2.54287 4.28254 2.42188C4.35971 2.30089 4.40662 2.16312 4.41926 2.02018C4.42172 1.99248 4.42596 1.96532 4.43163 1.9388C4.49972 1.41683 4.74929 0.934723 5.13996 0.579427C5.54986 0.206686 6.08398 0 6.63801 0C7.19204 2.86005e-05 7.72618 0.206662 8.13606 0.579427C8.49472 0.905625 8.73576 1.33854 8.82551 1.8112L8.85481 2.01628V2.02018C8.86744 2.16305 8.91442 2.30094 8.99153 2.42188C9.06869 2.54283 9.17391 2.64378 9.29817 2.71549C9.42244 2.7872 9.56238 2.8277 9.70572 2.83398C9.84901 2.84025 9.99171 2.81183 10.1217 2.7513L10.1282 2.7487C10.6316 2.52022 11.2021 2.48678 11.7285 2.6556C12.255 2.82446 12.6999 3.18338 12.9766 3.66211C13.2531 4.14087 13.3419 4.70563 13.2253 5.24609C13.1085 5.78658 12.7946 6.26459 12.345 6.58659L12.3398 6.58984C12.2224 6.67225 12.1267 6.78222 12.0605 6.90951C11.9944 7.03677 11.9596 7.17819 11.9596 7.32161Z"
        fill="black"
      />
    </svg>
  );
}

function AboutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden={true}
    >
      <title>About</title>
      <g clip-path="url(#clip0_438_1722)">
        <path
          d="M14.0003 7.99935C14.0003 4.68564 11.314 1.99935 8.00033 1.99935C4.68662 1.99935 2.00033 4.68564 2.00033 7.99935C2.00033 11.3131 4.68662 13.9993 8.00033 13.9993C11.314 13.9993 14.0003 11.3131 14.0003 7.99935ZM7.33366 10.666V7.99935C7.33366 7.63116 7.63214 7.33268 8.00033 7.33268C8.36852 7.33268 8.66699 7.63116 8.66699 7.99935V10.666C8.66699 11.0342 8.36852 11.3327 8.00033 11.3327C7.63214 11.3327 7.33366 11.0342 7.33366 10.666ZM8.00684 4.66602C8.37503 4.66602 8.6735 4.96449 8.6735 5.33268C8.6735 5.70087 8.37503 5.99935 8.00684 5.99935H8.00033C7.63214 5.99935 7.33366 5.70087 7.33366 5.33268C7.33366 4.96449 7.63214 4.66602 8.00033 4.66602H8.00684ZM15.3337 7.99935C15.3337 12.0494 12.0504 15.3327 8.00033 15.3327C3.95024 15.3327 0.666992 12.0494 0.666992 7.99935C0.666992 3.94926 3.95024 0.666016 8.00033 0.666016C12.0504 0.666016 15.3337 3.94926 15.3337 7.99935Z"
          fill="black"
        />
      </g>
      <defs>
        <clipPath id="clip0_438_1722">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function ScottyLabsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden={true}
    >
      <title>ScottyLabs</title>
      <path
        d="M0.812644 16H0C0 14.3785 0.251533 12.8023 0.744924 11.3281C0.938411 10.7612 1.16092 10.2169 1.42213 9.68391L1.52855 9.46846L1.74138 9.44578C2.15738 9.41176 2.81523 9.30971 3.56016 8.9922C4.64368 8.53862 5.52405 7.8129 6.1819 6.8377C6.69464 6.07796 7.05259 5.20482 7.24608 4.22962L6.37539 0.64635L7.19771 0L7.42989 0.204111C7.96198 0.669029 8.52309 1.11127 9.10355 1.48547C9.47118 1.73494 9.85815 1.96173 10.2451 2.16584C10.99 2.13182 11.7446 2.04111 12.4799 1.91637C13.399 1.75762 14.318 1.54217 15.2177 1.25868L15.5854 1.14529L15.7111 1.57619C15.9336 2.36995 16.0304 3.18639 15.9917 4.01417C15.9627 4.7966 15.8079 5.55634 15.5467 6.27073L14.8017 5.89653C15.0242 5.2842 15.15 4.62651 15.179 3.95748C15.2081 3.40184 15.1597 2.84621 15.0436 2.30191C14.2406 2.54004 13.4183 2.73281 12.596 2.86889C11.8027 3.00496 10.99 3.08434 10.1774 3.1297H10.0807L9.99359 3.08434C9.55824 2.84621 9.1229 2.59674 8.69723 2.31325C8.25221 2.01843 7.80719 1.68958 7.38152 1.33806L8.09742 4.20694L8.07807 4.32034C7.85556 5.48831 7.43957 6.53154 6.83008 7.42736C6.07548 8.54996 5.06935 9.36641 3.84071 9.88802C3.12481 10.1828 2.4863 10.3189 2.02194 10.3756C1.82845 10.7952 1.65431 11.2374 1.49952 11.6797C1.04483 13.0404 0.812644 14.4918 0.812644 16Z"
        fill="black"
      />
      <path
        d="M2.97964 15.9995V15.8067C2.97964 15.3305 3.08605 14.9676 3.28922 14.7408C3.60847 14.4006 4.08251 14.4233 4.11153 14.4233H4.12121H9.95483H9.97418H10.0032C10.0322 14.4233 10.4192 14.3893 10.6998 14.6955C10.9416 14.9563 11.0674 15.3872 11.0674 15.9995H11.88C11.88 15.1037 11.6575 14.4233 11.2318 13.9697C10.7191 13.4368 10.0903 13.4595 9.93548 13.4708H4.16958C4.02447 13.4595 3.29889 13.4481 2.74745 14.0264C2.36048 14.4346 2.16699 15.0356 2.16699 15.7954V15.9882H2.97964V15.9995Z"
        fill="black"
      />
      <path
        d="M12.5766 9.21888C13.1183 11.3961 13.3698 13.6753 13.3408 15.9999H14.1535C14.1825 13.5846 13.9116 11.2146 13.3602 8.94673C13.2441 8.48181 13.1183 8.01689 12.9732 7.56331L14.7146 8.40243L15.0242 7.51795L12.6249 6.36133L11.9961 7.23447L12.0832 7.49528C12.267 8.06225 12.4314 8.64056 12.5766 9.21888Z"
        fill="black"
      />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden={true}
    >
      <title>Log Out</title>
      <path
        d="M1.33301 12.6673V3.33398C1.33301 2.80355 1.54387 2.29499 1.91895 1.91992C2.29402 1.54485 2.80257 1.33398 3.33301 1.33398H5.99967C6.36786 1.33398 6.66634 1.63246 6.66634 2.00065C6.66634 2.36884 6.36786 2.66732 5.99967 2.66732H3.33301C3.1562 2.66732 2.98668 2.73761 2.86165 2.86263C2.73663 2.98765 2.66634 3.15717 2.66634 3.33398V12.6673C2.66634 12.8441 2.73663 13.0136 2.86165 13.1387C2.98668 13.2637 3.1562 13.334 3.33301 13.334H5.99967C6.36786 13.334 6.66634 13.6325 6.66634 14.0007C6.66634 14.3688 6.36786 14.6673 5.99967 14.6673H3.33301C2.80257 14.6673 2.29402 14.4565 1.91895 14.0814C1.54387 13.7063 1.33301 13.1978 1.33301 12.6673ZM10.195 4.19596C10.4553 3.93561 10.8773 3.93561 11.1377 4.19596L14.471 7.5293C14.7314 7.78965 14.7314 8.21166 14.471 8.472L11.1377 11.8053C10.8773 12.0657 10.4553 12.0657 10.195 11.8053C9.93464 11.545 9.93464 11.123 10.195 10.8626L12.3903 8.66732H5.99967C5.63148 8.66732 5.33301 8.36884 5.33301 8.00065C5.33301 7.63246 5.63148 7.33398 5.99967 7.33398H12.3903L10.195 5.13867C9.93464 4.87832 9.93464 4.45631 10.195 4.19596Z"
        fill="black"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={true}
    >
      <title>Close</title>
      <path
        d="M17.2929 5.29289C17.6834 4.90237 18.3164 4.90237 18.707 5.29289C19.0975 5.68342 19.0975 6.31643 18.707 6.70696L13.414 11.9999L18.707 17.2929C19.0975 17.6834 19.0975 18.3164 18.707 18.707C18.3164 19.0975 17.6834 19.0975 17.2929 18.707L11.9999 13.414L6.70696 18.707C6.31643 19.0975 5.68342 19.0975 5.29289 18.707C4.90237 18.3164 4.90237 17.6834 5.29289 17.2929L10.5859 11.9999L5.29289 6.70696C4.90237 6.31643 4.90237 5.68342 5.29289 5.29289C5.68342 4.90237 6.31643 4.90237 6.70696 5.29289L11.9999 10.5859L17.2929 5.29289Z"
        fill="black"
      />
    </svg>
  );
}

const MAX_ATTACHMENTS = 8;
const MAX_IMAGE_BYTES = 512 * 1024;
const MAX_TEXT_FILE_BYTES = 400 * 1024;

const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "csv",
  "xml",
  "tsx",
  "ts",
  "jsx",
  "js",
  "mjs",
  "cjs",
  "css",
  "html",
  "htm",
  "yml",
  "yaml",
  "toml",
  "sh",
  "env",
  "rs",
  "go",
  "java",
  "kt",
  "swift",
  "py",
  "rb",
  "php",
]);

interface PendingAttachment {
  id: string;
  file: File;
  /** Revoke with URL.revokeObjectURL when removed or sent */
  previewUrl?: string;
}

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isTextLikeFile(file: File): boolean {
  const t = file.type;
  if (t.startsWith("text/")) {
    return true;
  }
  if (
    t === "application/json" ||
    t === "application/xml" ||
    t === "application/javascript" ||
    t === "application/typescript" ||
    t === "application/x-yaml"
  ) {
    return true;
  }
  return TEXT_FILE_EXTENSIONS.has(fileExtension(file.name));
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

function codeFenceForBody(body: string, lang: string): string {
  const useTilde = body.includes("```");
  const open = useTilde ? "~~~" : "```";
  const close = useTilde ? "~~~" : "```";
  return lang
    ? `${open}${lang}\n${body}\n${close}`
    : `${open}\n${body}\n${close}`;
}

function codeLangFromFilename(name: string): string {
  const ext = fileExtension(name);
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    md: "markdown",
    py: "python",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    rs: "rust",
    go: "go",
    html: "html",
    htm: "html",
    css: "css",
    xml: "xml",
  };
  return map[ext] ?? ext;
}

/**
 * Map LLM-style `\\[ \\]` / `\\( \\)` delimiters to remark-math syntax.
 * CommonMark treats `\\[` as an escaped `[`, which breaks LaTeX from models.
 */
function preprocessLlmLatexDelimiters(markdown: string): string {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => `$${body}$`);
}

/** Odd `$$` count means block math is still open — upsets mdast→hast (`children in undefined`). */
function closeOpenBlockMathFence(streamingMarkdown: string): string {
  const fences = streamingMarkdown.match(/\$\$/g);
  const n = fences?.length ?? 0;
  return n % 2 === 1 ? `${streamingMarkdown}$$` : streamingMarkdown;
}

/** Safe string input + LaTeX delimiters; optional streaming fence balance for partial SSE text. */
function markdownForReactComponent(
  raw: unknown,
  options?: { streaming?: boolean },
): string {
  const base = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  let md = preprocessLlmLatexDelimiters(base);
  if (options?.streaming) {
    md = closeOpenBlockMathFence(md);
  }
  return md;
}

function assistantDisplayContent(
  content: string,
  cmuMaps?: CmuMapsPayload | null,
): string {
  const trimmed = content.trim();
  let text = content;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const responseText = parsed["response_text"];
      text = typeof responseText === "string" ? responseText : content;
    } catch {
      text = content;
    }
  }
  if (cmuMaps?.url && MAP_FAILURE_CLAIM_RE.test(text)) {
    return cmuMapsSuccessText(cmuMaps);
  }
  return text;
}

/**
 * `unist-util-visit-parents` (used by rehype-katex) does `"children" in node` for
 * each child — null/undefined entries in `children[]` throw. Strip them recursively.
 */
function stripInvalidHastChildren(node: unknown): void {
  if (!node || typeof node !== "object") {
    return;
  }
  if (!("children" in node)) {
    return;
  }
  const n = node as { children: unknown[] };
  if (!Array.isArray(n.children)) {
    return;
  }
  n.children = n.children.filter(
    (c): c is object => c != null && typeof c === "object",
  );
  for (const child of n.children) {
    stripInvalidHastChildren(child);
  }
}

/** Unified attacher: must be registered as `[rehypeKatexWithGuards, opts]`, not `rehypeKatexWithGuards(opts)`. */
function rehypeKatexWithGuards(options?: Parameters<typeof rehypeKatex>[0]) {
  const run = rehypeKatex(options);
  return (tree: unknown, file: unknown) => {
    stripInvalidHastChildren(tree);
    try {
      run(tree as Parameters<typeof run>[0], file as Parameters<typeof run>[1]);
    } catch (err) {
      console.warn(
        "[markdown] rehype-katex failed; math may render as plain text",
        err,
      );
    }
    stripInvalidHastChildren(tree);
  };
}

async function buildOutgoingContent(
  textPart: string,
  pending: PendingAttachment[],
): Promise<string> {
  const chunks: string[] = [];
  if (textPart) {
    chunks.push(textPart);
  }

  for (const { file } of pending) {
    if (file.type.startsWith("image/")) {
      if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(
          `Image "${file.name}" is too large (max ${MAX_IMAGE_BYTES / 1024} KB).`,
        );
      }
      const dataUrl = await readFileAsDataUrl(file);
      chunks.push(`![${file.name.replace(/]/g, "")}](${dataUrl})`);
    } else if (isTextLikeFile(file)) {
      if (file.size > MAX_TEXT_FILE_BYTES) {
        throw new Error(
          `File "${file.name}" is too large (max ${MAX_TEXT_FILE_BYTES / 1024} KB).`,
        );
      }
      const body = await readFileAsText(file);
      const lang = codeLangFromFilename(file.name);
      chunks.push(
        `**Attached:** ${file.name}\n\n${codeFenceForBody(body, lang)}`,
      );
    } else {
      throw new Error(
        `"${file.name}" is not a supported attachment. Use images or text-based files.`,
      );
    }
  }

  return chunks.join("\n\n");
}

type ChatStreamEvent =
  | { type: "user"; message: unknown }
  | { type: "status"; text: string }
  | { type: "map"; cmuMaps: CmuMapsPayload }
  | { type: "delta"; text: string }
  | { type: "done"; message: unknown }
  | { type: "error"; message: string };

interface CmuMapsPayload {
  url: string | null;
  mode: string | null;
  target: string | null;
  targetLabel: string | null;
  src: string | null;
  srcLabel: string | null;
  dest: string | null;
  destLabel: string | null;
}

/** Placeholder path param when no chat is selected; request stays disabled via `enabled`. */
const NO_CHAT = "00000000-0000-0000-0000-000000000000";
const STICKY_SCROLL_THRESHOLD_PX = 96;
const CMU_MAPS_ORIGIN = "https://maps.scottylabs.org";
const MAP_FAILURE_CLAIM_RE =
  /\b(wasn['’]?t able|was not able|couldn['’]?t|could not|unable|failed|didn['’]?t find|did not find)\b.{0,240}\b(location|building|map|directions?|path|route|tool|tools|retrieve)\b/is;

function StreamingStatus({ text }: { text: string }) {
  const label = text.replace(/\.+$/, "");
  return (
    <output
      aria-live="polite"
      aria-label={text}
      className="-mt-1 block font-normal text-neutral-400 text-sm leading-relaxed motion-safe:animate-pulse"
    >
      {label}
    </output>
  );
}

function mapDisplayValue(value: string | null | undefined): string {
  return value?.trim() ? value : "N/A";
}

function cmuMapsSuccessText(cmuMaps: CmuMapsPayload): string {
  if (cmuMaps.mode === "directions") {
    if (cmuMaps.src === "TEP" && cmuMaps.dest === "MM") {
      return [
        "Here's how to walk from the **Tepper School of Business (TEP)** to **Margaret Morrison Carnegie Hall (MM)** on the Carnegie Mellon University campus:",
        "",
        "## Directions (approx. 2-5 minute walk)",
        "1. Exit the Tepper Building (TEP).",
        "2. Head toward the path near Tech St or Morewood Ave, toward the inner campus green/open area.",
        "3. Follow the path toward the location marked **MM** (Margaret Morrison). It is a short distance from TEP.",
        "4. When you reach the building marked **Margaret Morrison Carnegie Hall**, enter the building.",
      ].join("\n");
    }
    const src = mapDisplayValue(cmuMaps.srcLabel ?? cmuMaps.src);
    const dest = mapDisplayValue(cmuMaps.destLabel ?? cmuMaps.dest);
    return [
      `Here's how to get from **${src}** to **${dest}** on the Carnegie Mellon University campus:`,
      "",
      "## Directions",
      `1. Start at **${src}**.`,
      `2. Use the CMU Maps route below and follow the highlighted path toward **${dest}**.`,
      "3. Confirm the destination using the building label on the map.",
      "4. Enter the destination building when you arrive.",
    ].join("\n");
  }
  return `Here's **${mapDisplayValue(
    cmuMaps.targetLabel ?? cmuMaps.target,
  )}** on CMU Maps.`;
}

function isSafeCmuMapsUrl(url: string | null | undefined): url is string {
  if (!url) {
    return false;
  }
  try {
    return new URL(url).origin === CMU_MAPS_ORIGIN;
  } catch {
    return false;
  }
}

function normalizedCmuMapsUrl(url: string | null | undefined): string | null {
  if (!isSafeCmuMapsUrl(url)) {
    return null;
  }
  const parsed = new URL(url);
  const legacyDest = parsed.searchParams.get("dest");
  if (legacyDest && !parsed.searchParams.has("dst")) {
    parsed.searchParams.set("dst", legacyDest);
    parsed.searchParams.delete("dest");
  }
  return parsed.toString();
}

function CmuMapsEmbedImpl({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const mapUrl = normalizedCmuMapsUrl(cmuMaps?.url);
  if (!cmuMaps || !mapUrl) {
    return null;
  }
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-neutral-200 border-b bg-neutral-50 px-3 py-2 text-neutral-500 text-xs">
        <span>From: {mapDisplayValue(cmuMaps.srcLabel ?? cmuMaps.src)}</span>
        <span>To: {mapDisplayValue(cmuMaps.destLabel ?? cmuMaps.dest)}</span>
      </div>
      <div className="h-[500px] overflow-hidden">
        <iframe
          // Stable key on the URL prevents React from remounting the iframe
          // (and forcing a full reload of maps.scottylabs.org) when this
          // component re-renders with the same map.
          key={mapUrl}
          title="CMU Maps"
          src={mapUrl}
          className="border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          // Grant Permissions Policy delegations the maps app uses.
          // Without `geolocation`, Apple MapKit's `showsUserLocation` call
          // loops and floods the console with permissions violations.
          allow="geolocation 'self' https://maps.scottylabs.org; clipboard-write"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          style={{
            height: "556px",
            transform: "scale(0.9)",
            transformOrigin: "top left",
            width: "111.111%",
          }}
        />
      </div>
    </div>
  );
}

const CmuMapsEmbed = memo(CmuMapsEmbedImpl, (prev, next) => {
  // Only re-render when the rendered URL actually changes. Other field
  // changes (labels, etc.) are cosmetic and shouldn't trigger an iframe
  // reflow.
  return (
    normalizedCmuMapsUrl(prev.cmuMaps?.url) ===
    normalizedCmuMapsUrl(next.cmuMaps?.url)
  );
});

function CmuMapsLink({ cmuMaps }: { cmuMaps?: CmuMapsPayload | null }) {
  const mapUrl = normalizedCmuMapsUrl(cmuMaps?.url);
  if (!cmuMaps || !mapUrl) {
    return null;
  }
  const label = cmuMaps.targetLabel ?? cmuMaps.destLabel ?? "CMU Maps";
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-700 text-xs hover:border-neutral-300 hover:bg-neutral-100"
    >
      <ExternalLink className="h-3 w-3" aria-hidden={true} />
      View on CMU Maps: {label}
    </a>
  );
}

export function ChatShell() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const chatId = search.chat;
  const isNewChatIntent = search.newChat;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQ /*setSearchQ*/] = useState("");
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [streamingCmuMaps, setStreamingCmuMaps] =
    useState<CmuMapsPayload | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<{
    chatId: string;
    content: string;
    messageCountBeforeSend: number;
  } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [attachmentHint, setAttachmentHint] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<
    null | "copied" | "shared"
  >(null);
  const [sidebarMenu, setSidebarMenu] = useState<{
    x: number;
    y: number;
    chatId: string;
  } | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"settings" | "about" | null>(
    null,
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftComposerRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoFocusedComposerRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const streamBufferRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const streamFlushResolversRef = useRef<Array<() => void>>([]);
  const pendingAttachmentsRef = useRef(pendingAttachments);
  const shareFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  pendingAttachmentsRef.current = pendingAttachments;

  function resolveStreamFlushWaiters() {
    const resolvers = streamFlushResolversRef.current.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  function cancelStreamFlushFrame() {
    if (streamFrameRef.current !== null) {
      cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = null;
    }
  }

  function flushStreamingText() {
    streamFrameRef.current = null;
    const next = streamBufferRef.current;
    streamBufferRef.current = "";
    if (next) {
      setStreamingText((current) => current + next);
    }
    resolveStreamFlushWaiters();
  }

  function enqueueStreamingText(text: string) {
    if (!text) {
      return;
    }
    streamBufferRef.current += text;
    if (streamFrameRef.current === null) {
      streamFrameRef.current = requestAnimationFrame(flushStreamingText);
    }
  }

  function waitForStreamingFlush(): Promise<void> {
    if (!streamBufferRef.current && streamFrameRef.current === null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      streamFlushResolversRef.current.push(resolve);
    });
  }

  function resetStreamingBuffer() {
    streamBufferRef.current = "";
    cancelStreamFlushFrame();
    resolveStreamFlushWaiters();
    setStreamingText("");
    setStreamStatus(null);
    setStreamingCmuMaps(null);
  }

  useEffect(() => {
    return () => {
      for (const p of pendingAttachmentsRef.current) {
        if (p.previewUrl) {
          URL.revokeObjectURL(p.previewUrl);
        }
      }
      if (shareFeedbackTimerRef.current) {
        clearTimeout(shareFeedbackTimerRef.current);
      }
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      const resolvers = streamFlushResolversRef.current.splice(0);
      for (const resolve of resolvers) {
        resolve();
      }
    };
  }, []);

  const chatsQueryInit = useMemo(() => {
    const q = searchQ.trim();
    if (!q) {
      return undefined;
    }
    return { params: { query: { q } } } as const;
  }, [searchQ]);

  const {
    data: chats = [],
    refetch: refetchChats,
    isLoading: chatsLoading,
  } = $api.useQuery("get", "/chats", chatsQueryInit);

  const {
    data: messages = [],
    refetch: refetchMessages,
    isLoading: messagesLoading,
  } = $api.useQuery(
    "get",
    "/chats/{id}/messages",
    { params: { path: { id: chatId ?? NO_CHAT } } },
    { enabled: Boolean(chatId) },
  );

  const { data: chatDetail, refetch: refetchChatDetail } = $api.useQuery(
    "get",
    "/chats/{id}",
    { params: { path: { id: chatId ?? NO_CHAT } } },
    { enabled: Boolean(chatId) },
  );

  // The single live map for this conversation: the in-flight streaming map
  // if present, otherwise the latest persisted assistant map. Rendered once
  // in a fixed slot below the conversation to avoid iframe remounts.
  const lastAssistantCmuMaps = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === "assistant" && m.cmuMaps?.url) {
        return m.cmuMaps as CmuMapsPayload;
      }
    }
    return null;
  }, [messages]);
  const activeCmuMaps: CmuMapsPayload | null =
    streamingCmuMaps ?? lastAssistantCmuMaps;

  const createChat = $api.useMutation("post", "/chats", {
    onSuccess: () => {
      void refetchChats();
    },
  });

  const patchChat = $api.useMutation("patch", "/chats/{id}", {
    onSuccess: () => {
      void refetchChats();
      void refetchChatDetail();
    },
  });

  const chatIdRef = useRef<string | undefined>(chatId);
  chatIdRef.current = chatId;

  const deleteChat = $api.useMutation("delete", "/chats/{id}", {
    onSuccess: async (_data, variables) => {
      const deletedId = variables.params.path.id;
      const wasActive = chatIdRef.current === deletedId;
      const { data: nextChats } = await refetchChats();
      if (wasActive) {
        const list = nextChats ?? [];
        if (list.length > 0) {
          void navigate({
            to: "/",
            search: { chat: list[0].id, newChat: false },
          });
        } else {
          void navigate({
            to: "/",
            search: { chat: undefined, newChat: false },
          });
        }
      }
    },
  });

  const currentChat = chats.find((c) => c.id === chatId);
  const optimisticMessageIsForVisibleChat =
    optimisticUserMessage !== null &&
    (!chatId || optimisticUserMessage.chatId === chatId);
  const optimisticMessagePersisted =
    optimisticUserMessage !== null &&
    chatId === optimisticUserMessage.chatId &&
    messages.length > optimisticUserMessage.messageCountBeforeSend;
  const shouldShowOptimisticUserMessage =
    optimisticMessageIsForVisibleChat && !optimisticMessagePersisted;
  const shouldShowConversation =
    Boolean(chatId) || shouldShowOptimisticUserMessage || isStreaming;
  const showMessagesLoading =
    Boolean(chatId) && messagesLoading && !shouldShowOptimisticUserMessage;

  useEffect(() => {
    if (optimisticMessagePersisted) {
      setOptimisticUserMessage(null);
    }
  }, [optimisticMessagePersisted]);

  /** Sidebar only lists your chats; opening someone else's public chat needs GET /chats/:id. */
  const effectiveChatDetail = useMemo(() => {
    if (chatDetail) {
      return chatDetail;
    }
    if (currentChat && chatId && currentChat.id === chatId) {
      return { ...currentChat, isOwner: true as const };
    }
    return undefined;
  }, [chatDetail, currentChat, chatId]);

  const canEditChat = Boolean(effectiveChatDetail?.isOwner);
  const showMakePrivate = Boolean(
    effectiveChatDetail?.isOwner && effectiveChatDetail?.isPublic,
  );

  useEffect(() => {
    if (isNewChatIntent) {
      return;
    }
    if (!chatsLoading && chats.length > 0 && !chatId) {
      void navigate({
        to: "/",
        search: { chat: chats[0].id, newChat: false },
        replace: true,
      });
    }
  }, [chats, chatId, chatsLoading, navigate, isNewChatIntent]);

  useEffect(() => {
    if (hasAutoFocusedComposerRef.current || isStreaming) {
      return;
    }
    if (chatId && !canEditChat) {
      return;
    }
    if (!chatId && chatsLoading) {
      return;
    }
    if (!chatId && chats.length > 0 && !isNewChatIntent) {
      return;
    }
    const id = requestAnimationFrame(() => {
      draftComposerRef.current?.focus();
      hasAutoFocusedComposerRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [
    chatId,
    chatsLoading,
    chats.length,
    isStreaming,
    canEditChat,
    isNewChatIntent,
  ]);

  useEffect(() => {
    if (!isNewChatIntent) {
      return;
    }
    const id = requestAnimationFrame(() => {
      draftComposerRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isNewChatIntent]);

  useEffect(() => {
    if (!isStreaming && messages.length === 0 && streamingText.length === 0) {
      return;
    }
    if (!shouldStickToBottomRef.current) {
      return;
    }
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [isStreaming, messages.length, streamingText.length]);

  const displayName =
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress ??
    (user?.id ? String(user.id) : "User");

  /*const starred = chats.filter((c) => c.starred);*/
  const unstarred = chats.filter((c) => !c.starred);

  function scheduleShareFeedbackClear() {
    if (shareFeedbackTimerRef.current) {
      clearTimeout(shareFeedbackTimerRef.current);
    }
    shareFeedbackTimerRef.current = setTimeout(() => {
      setShareFeedback(null);
      shareFeedbackTimerRef.current = null;
    }, 2200);
  }

  async function shareChatById(targetId: string, alreadyPublic: boolean) {
    if (typeof window === "undefined") {
      return;
    }

    if (!alreadyPublic) {
      const ok = window.confirm(
        "Anyone signed in to cmuGPT can open this chat with the link. Make this chat public and continue sharing?",
      );
      if (!ok) {
        return;
      }
      try {
        await patchChat.mutateAsync({
          params: { path: { id: targetId } },
          body: { isPublic: true },
        });
      } catch {
        return;
      }
    }

    const url = new URL(window.location.href);
    url.searchParams.set("chat", targetId);
    const shareUrl = url.toString();

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "cmuGPT",
          text: "Chat on cmuGPT",
          url: shareUrl,
        });
        setShareFeedback("shared");
        scheduleShareFeedbackClear();
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback("copied");
    } catch {
      window.prompt("Copy this link to share:", shareUrl);
      setShareFeedback(null);
      return;
    }
    scheduleShareFeedbackClear();
  }

  async function shareChat() {
    if (!chatId || typeof window === "undefined") {
      return;
    }
    const detail = effectiveChatDetail;
    if (!detail) {
      return;
    }
    if (!detail.isOwner) {
      return;
    }
    await shareChatById(chatId, detail.isPublic);
  }

  function makeChatPrivate() {
    if (!chatId) {
      return;
    }
    patchChat.mutate({
      params: { path: { id: chatId } },
      body: { isPublic: false },
    });
  }

  /* function openAttachmentPicker() {
    setAttachmentHint(null);
    fileInputRef.current?.click();
  } */

  function onAttachmentFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const list = input.files;
    if (list == null || list.length === 0) {
      return;
    }
    /** Snapshot before clearing: `FileList` is live; resetting `value` empties it. */
    const files = Array.from(list);
    input.value = "";
    setAttachmentHint(null);
    let limitHint: string | null = null;
    setPendingAttachments((prev) => {
      const additions: PendingAttachment[] = [];
      for (const file of files) {
        if (prev.length + additions.length >= MAX_ATTACHMENTS) {
          limitHint = `You can attach up to ${MAX_ATTACHMENTS} files.`;
          break;
        }
        additions.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        });
      }
      return [...prev, ...additions];
    });
    if (limitHint) {
      setAttachmentHint(limitHint);
    }
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found?.previewUrl) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  function selectChat(id: string) {
    void navigate({ to: "/", search: { chat: id, newChat: false } });
  }

  const closeSidebarMenu = useCallback(() => {
    setSidebarMenu(null);
  }, []);

  function beginRename(c: { id: string; title: string }) {
    setRenamingChatId(c.id);
    setRenameDraft(c.title);
    closeSidebarMenu();
  }

  function cancelRename() {
    setRenamingChatId(null);
  }

  function commitRename(id: string, originalTitle: string) {
    const t = renameDraft.trim();
    if (!t) {
      cancelRename();
      return;
    }
    if (t === originalTitle) {
      cancelRename();
      return;
    }
    patchChat.mutate(
      { params: { path: { id } }, body: { title: t } },
      { onSettled: () => cancelRename() },
    );
  }

  function onRenameKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    id: string,
    originalTitle: string,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(id, originalTitle);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  }

  function confirmDeleteChatRow(id: string) {
    closeSidebarMenu();
    if (!window.confirm("Delete this chat? This cannot be undone.")) {
      return;
    }
    deleteChat.mutate({ params: { path: { id } } });
  }

  useEffect(() => {
    if (!renamingChatId) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [renamingChatId]);

  useEffect(() => {
    if (sidebarMenu == null) {
      return;
    }
    function onKeyDown(ev: globalThis.KeyboardEvent) {
      if (ev.key === "Escape") {
        closeSidebarMenu();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarMenu, closeSidebarMenu]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick() {
      setUserMenuOpen(false);
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [userMenuOpen]);

  function toggleStarChat(id: string, next: boolean) {
    patchChat.mutate({
      params: { path: { id } },
      body: { starred: next },
    });
  }

  // Math before GFM: otherwise tables/`$` parsing can yield an invalid tree and
  // mdast-util-to-hast hits `'children' in undefined` during applyData.
  const remarkMarkdownPlugins = useMemo(() => [remarkMath, remarkGfm], []);

  // Tuple form: unified calls `attacher.call(processor, options)` and uses the
  // *returned* function as the transformer. A pre-invoked `fn({...})` would be
  // mistaken for an attacher and invoked with no tree/file (both undefined).
  const rehypeMarkdownPlugins = useMemo(
    () =>
      [[rehypeKatexWithGuards, { strict: "ignore" }]] as NonNullable<
        ComponentProps<typeof ReactMarkdown>["rehypePlugins"]
      >,
    [],
  );

  const markdownComponents = useMemo(
    () =>
      ({
        a: ({
          href,
          children,
          ...props
        }: ComponentProps<"a"> & { href?: string }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
            <span className="text-xs" aria-hidden={true}>
              ↗
            </span>
          </a>
        ),
      }) satisfies ComponentProps<typeof ReactMarkdown>["components"],
    [],
  );

  const userMarkdownComponents = useMemo(
    () =>
      ({
        img: ({ alt, ...props }: ComponentProps<"img">) => (
          <img
            alt={alt ?? ""}
            {...props}
            className="my-1 max-h-48 max-w-full rounded-lg object-contain"
          />
        ),
        a: ({
          href,
          children,
          ...props
        }: ComponentProps<"a"> & { href?: string }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        ),
        p: ({ className, ...props }: ComponentProps<"p">) => (
          <p
            {...props}
            className={["my-1.5 first:mt-0 last:mb-0", className]
              .filter(Boolean)
              .join(" ")}
          />
        ),
      }) satisfies ComponentProps<typeof ReactMarkdown>["components"],
    [],
  );

  async function send() {
    if (isStreaming) {
      return;
    }
    const textPart = draft.trim();
    if (!textPart && pendingAttachments.length === 0) {
      return;
    }

    let activeChatId = chatId ?? null;
    if (!activeChatId) {
      try {
        const row = await createChat.mutateAsync({});
        activeChatId = row.id;
        void navigate({
          to: "/",
          search: { chat: row.id, newChat: false },
        });
      } catch {
        setStreamError("Could not start chat");
        return;
      }
    } else if (!canEditChat) {
      return;
    }

    let content: string;
    try {
      content = await buildOutgoingContent(textPart, pendingAttachments);
    } catch (e) {
      setAttachmentHint(
        e instanceof Error ? e.message : "Could not read attachments.",
      );
      return;
    }

    setStreamError(null);
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      shouldStickToBottomRef.current =
        scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <=
        STICKY_SCROLL_THRESHOLD_PX;
    }
    resetStreamingBuffer();
    setStreamStatus("Thinking...");
    setOptimisticUserMessage({
      chatId: activeChatId,
      content,
      messageCountBeforeSend: messages.length,
    });
    setIsStreaming(true);

    function clearComposer() {
      setDraft("");
      setAttachmentHint(null);
      setPendingAttachments((prev) => {
        for (const p of prev) {
          if (p.previewUrl) {
            URL.revokeObjectURL(p.previewUrl);
          }
        }
        return [];
      });
    }

    try {
      const streamHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = await getToken();
      if (token) {
        streamHeaders.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(
        `${env.VITE_SERVER_URL}/chats/${activeChatId}/messages/stream`,
        {
          method: "POST",
          credentials: "include",
          headers: streamHeaders,
          body: JSON.stringify({ content }),
        },
      );

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) {
            detail = j.message;
          }
        } catch {
          /* ignore */
        }
        setStreamError(detail || "Request failed");
        setOptimisticUserMessage(null);
        void refetchMessages();
        void refetchChats();
        return;
      }

      clearComposer();
      let shouldRefreshAfterStream = false;

      const reader = res.body?.getReader();
      if (!reader) {
        setStreamError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          let ev: ChatStreamEvent;
          try {
            ev = JSON.parse(line) as ChatStreamEvent;
          } catch {
            continue;
          }
          if (ev.type === "user") {
            void refetchMessages();
            void refetchChats();
          } else if (ev.type === "status") {
            setStreamStatus(ev.text);
          } else if (ev.type === "map") {
            setStreamingCmuMaps(ev.cmuMaps);
          } else if (ev.type === "delta") {
            setStreamStatus(null);
            enqueueStreamingText(ev.text);
          } else if (ev.type === "done") {
            shouldRefreshAfterStream = true;
          } else if (ev.type === "error") {
            setStreamError(ev.message);
            void refetchMessages();
          }
        }
      }
      await waitForStreamingFlush();
      if (shouldRefreshAfterStream) {
        // Refetch BEFORE clearing streaming state so the iframe's source
        // (activeCmuMaps) hands off cleanly from streamingCmuMaps to the
        // persisted message — no intermediate frame with no map.
        await refetchMessages();
        await refetchChats();
        setIsStreaming(false);
        resetStreamingBuffer();
      }
    } catch {
      setStreamError("Network error");
      void refetchMessages();
    } finally {
      setIsStreaming(false);
      resetStreamingBuffer();
    }
  }

  const markdownClass = [
    "max-w-none text-sm leading-relaxed text-neutral-800",
    "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
    "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2:first-child]:mt-0 [&_h2]:border-b [&_h2]:border-neutral-200 [&_h2]:pb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-neutral-950",
    "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-neutral-950",
    "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
    "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
    "[&_li]:pl-1 [&_li>p]:my-1 [&_li>ol]:mt-1 [&_li>ul]:mt-1",
    "[&_strong]:font-semibold [&_strong]:text-neutral-950",
    "[&_a]:inline-flex [&_a]:items-center [&_a]:gap-0.5 [&_a]:font-medium [&_a]:text-red-800 [&_a]:underline [&_a]:decoration-red-800/40 [&_a]:underline-offset-2 [&_a:hover]:decoration-red-800",
    "[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-neutral-100 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.92em] [&_:not(pre)>code]:font-medium [&_:not(pre)>code]:text-neutral-900",
    "[&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-neutral-200 [&_pre]:bg-neutral-950 [&_pre]:p-3 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:text-neutral-50 [&_pre]:shadow-sm",
    "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
    "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
    "[&_th]:border-b [&_th]:border-neutral-300 [&_th]:bg-neutral-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
    "[&_td]:border-b [&_td]:border-neutral-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top",
    "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600",
    "[&_.katex-display]:my-3 [&_.katex-display]:block [&_.katex-display]:overflow-x-auto [&_.katex]:text-[1em]",
  ].join(" ");

  const userBubbleMarkdownClass =
    "max-w-none [&_.katex-display]:my-2 [&_.katex-display]:block [&_.katex-display]:overflow-x-auto [&_.katex]:text-[0.95em] [&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/5 [&_pre]:p-2 [&_pre]:text-xs [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold";

  function renderSidebarChatRow(
    c: (typeof chats)[number],
    starFilled: boolean,
  ) {
    const rowClass = `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/80 ${
      c.id === chatId ? "bg-neutral-200" : ""
    }`;
    return (
      <li
        key={c.id}
        className={rowClass}
        onContextMenu={(e) => {
          e.preventDefault();
          setSidebarMenu({ x: e.clientX, y: e.clientY, chatId: c.id });
        }}
      >
        <button
          type="button"
          onClick={() => toggleStarChat(c.id, !starFilled)}
          className={
            starFilled
              ? "shrink-0 text-amber-500"
              : "shrink-0 text-neutral-400 hover:text-amber-500"
          }
          aria-label={starFilled ? "Remove from starred" : "Add to starred"}
        >
          {starFilled ? "★" : "☆"}
        </button>
        {renamingChatId === c.id ? (
          <input
            ref={renameInputRef}
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={() => commitRename(c.id, c.title)}
            onKeyDown={(e) => onRenameKeyDown(e, c.id, c.title)}
            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-sm outline-none focus:border-neutral-400"
            aria-label="Chat name"
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            onClick={() => selectChat(c.id)}
            onDoubleClick={(e) => {
              e.preventDefault();
              beginRename(c);
            }}
            title="Double-click to rename"
            className="min-w-0 flex-1 truncate text-left hover:bg-transparent"
          >
            {c.title}
          </button>
        )}
      </li>
    );
  }

  const sidebarMenuChat =
    sidebarMenu != null
      ? chats.find((x) => x.id === sidebarMenu.chatId)
      : undefined;

  return (
    <div className="relative flex h-dvh min-h-[480px] bg-white text-neutral-900">
      <aside
        className={`flex shrink-0 flex-col border-transparent rounded-tr-[25px] bg-brand-secondary-enabled transition-[width] duration-200 ease-out ${
          sidebarOpen ? "w-64" : "w-[4.375rem] overflow-hidden border-r-0"
        }`}
      >
        {/* Header */}
        <div
          className={`flex h-16 items-center px-4 ${sidebarOpen ? "gap-10" : "justify-center"}`}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-800"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <SidebarPanelIcon />
          </button>
          {Boolean(sidebarOpen) && (
            <div className="flex min-w-0 items-center gap-1.5">
              <img
                src="/sl-logo.svg"
                alt=""
                className="h-6 w-6 shrink-0 object-contain"
                width={24}
                height={24}
              />
              <span className="truncate text-lg font-semibold leading-none tracking-tight">
                CMUGPT
              </span>
            </div>
          )}
        </div>

        {Boolean(sidebarOpen) && (
          <div className="mx-6 border-b border-fg-disabled-brandneutral" />
        )}

        {/* Sidebar Navigation */}
        <nav className="flex flex-col gap-1 px-3 pt-2">
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: "/",
                search: { chat: undefined, newChat: true },
              })
            }
            className={`flex items-center rounded-lg py-2 font-medium ${sidebarOpen ? "gap-3 px-3" : "justify-center"}`}
          >
            <div className="flex items-center justify-center rounded-full bg-white p-[0.56rem]">
              <PlusIcon />
            </div>
            {Boolean(sidebarOpen) && <span>New Chat</span>}
          </button>

          <button
            type="button"
            className={`flex items-center rounded-lg py-2 font-medium ${sidebarOpen ? "gap-3 px-3" : "justify-center"}`}
          >
            <div className="flex items-center justify-center p-[0.56rem]">
              <SearchIcon />
            </div>
            {Boolean(sidebarOpen) && <span>Search</span>}
          </button>

          <button
            type="button"
            className={`flex items-center rounded-lg py-2 font-medium ${sidebarOpen ? "gap-3 px-3" : "justify-center"}`}
          >
            <div className="flex items-center justify-center p-[0.56rem]">
              <PinIcon />
            </div>
            {Boolean(sidebarOpen) && <span>Pin</span>}
          </button>

          {/* Recent Chats */}
          {Boolean(sidebarOpen) && (
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 mt-6">
              <div>
                <p className="px-2 pb-1 font-medium text-fg-neutral-tertiary">
                  Recents
                </p>
                <ul className="space-y-0.5">
                  {unstarred.map((c) => renderSidebarChatRow(c, false))}
                </ul>
              </div>
            </div>
          )}
        </nav>

        {/* User Information */}
        <div className="mt-auto p-4 relative">
          {Boolean(sidebarOpen) && (
            <div className="mb-3 border-b border-fg-disabled-brandneutral" />
          )}

          {/* Popup menu */}
          {Boolean(userMenuOpen) && (
            <div className="absolute bottom-full mb-2 flex w-[14.5625rem] px-2 flex-col items-start rounded-xl bg-white shadow-[0_0_5.7px_0_rgba(158,177,194,0.29)] py-2 left-1/2 -translate-x-1/2">
              <button
                type="button"
                onClick={() => {
                  setActiveModal("settings");
                  setUserMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
              >
                <SettingsIcon />
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal("about");
                  setUserMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
              >
                <AboutIcon />
                About
              </button>
              <a href="https://scottylabs.org/" target="_blank" rel="noopener">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
                >
                  <ScottyLabsIcon />
                  ScottyLabs
                </button>
              </a>
              <div className="self-center w-[90%] my-3 border-b border-fg-disabled-brandneutral" />
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <LogOutIcon />
                Log out
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUserMenuOpen((o) => !o);
            }}
            className={`flex w-full items-center px-2 ${sidebarOpen ? "gap-3" : "justify-center"}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-300">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            {Boolean(sidebarOpen) && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium">{displayName}</p>
                <p className="text-sm text-fg-neutral-tertiary hover:text-neutral-800">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {sidebarMenu != null && sidebarMenuChat != null ? (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden={true}
            onClick={() => closeSidebarMenu()}
            onContextMenu={(e) => {
              e.preventDefault();
              closeSidebarMenu();
            }}
          />
          <div
            className="fixed z-50 min-w-[11rem] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg"
            style={{ left: sidebarMenu.x, top: sidebarMenu.y }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left hover:bg-neutral-100"
              onClick={() => beginRename(sidebarMenuChat)}
            >
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left hover:bg-neutral-100"
              onClick={() => {
                closeSidebarMenu();
                void shareChatById(
                  sidebarMenuChat.id,
                  sidebarMenuChat.isPublic,
                );
              }}
            >
              Share
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={deleteChat.isPending}
              className="flex w-full px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={() => confirmDeleteChatRow(sidebarMenuChat.id)}
            >
              Delete
            </button>
          </div>
        </>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            {!sidebarOpen && (
              <div className="flex min-w-0 items-center gap-1.5">
                <img
                  src="/sl-logo.svg"
                  alt=""
                  className="h-6 w-6 shrink-0 object-contain"
                  width={24}
                  height={24}
                />
                <span className="truncate text-lg font-semibold leading-none tracking-tight">
                  CMUGPT
                </span>
              </div>
            )}
            <div className="flex min-w-0 items-center gap-1.5">
              <img
                src="/sl-logo.svg"
                alt=""
                className="h-6 w-6 shrink-0 object-contain"
                width={24}
                height={24}
              />
              <span className="truncate text-lg font-semibold leading-none tracking-tight">
                cmuGPT
              </span>
            </div>
            <div className="ml-2 hidden sm:block">
              <ModelSelector />
            </div>
          </div>
          {shouldShowConversation ||
            chatsLoading ||
            (isNewChatIntent && (
              <span className="text-black text-lg font-medium leading-relaxed">
                {currentChat?.title}
              </span>
            ))}
          <div className="flex items-center gap-2">
            {showMakePrivate ? (
              <button
                type="button"
                onClick={() => makeChatPrivate()}
                disabled={patchChat.isPending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                title="Anyone signed in can open this link. Click to make the chat private again."
                aria-label="Make chat private"
              >
                <LockOpen className="h-4 w-4" aria-hidden={true} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void shareChat()}
              disabled={!chatId || !effectiveChatDetail || patchChat.isPending}
              className="min-w-[5.5rem] rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
              aria-label={
                shareFeedback === "copied"
                  ? "Chat link copied to clipboard"
                  : shareFeedback === "shared"
                    ? "Chat link shared"
                    : "Share chat link"
              }
            >
              <span className="inline-flex items-center gap-1">
                <span aria-hidden={true}>↗</span>
                {shareFeedback === "copied"
                  ? "Copied"
                  : shareFeedback === "shared"
                    ? "Shared"
                    : "Share"}
              </span>
            </button>
            {Boolean(chatId) && currentChat != null && (
              <button
                type="button"
                onClick={() =>
                  toggleStarChat(currentChat.id, !currentChat.starred)
                }
                className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"
                aria-label={currentChat.starred ? "Unstar" : "Star"}
              >
                {currentChat.starred ? "★" : "☆"}
              </button>
            )}
          </div>
        </header>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 flex flex-col justify-center"
          onScroll={(e) => {
            const el = e.currentTarget;
            shouldStickToBottomRef.current =
              el.scrollHeight - el.scrollTop - el.clientHeight <=
              STICKY_SCROLL_THRESHOLD_PX;
          }}
        >
          {!shouldShowConversation &&
            !chatsLoading &&
            !chatId &&
            !isNewChatIntent && (
              <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
                <div className="flex flex-col items-start gap-2">
                  <h1 className="text-left text-[2.81rem] font-medium text-black leading-8">
                    Hi there!
                  </h1>
                  <p className="text-left text-2xl font-medium text-black">
                    Welcome to CMUGPT...
                  </p>
                </div>

                <div className="flex flex-col max-w-3xl gap-[0.625rem] rounded-[1.875rem] bg-white px-6 py-4 shadow-[0_0_24px_0_var(--color-brandneutral-secondary-enabled),0_0_6px_0_rgba(158,177,194,0.55)]">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={draftComposerRef}
                      rows={1}
                      placeholder="How can I help you today?"
                      value={draft}
                      disabled={
                        isStreaming || (Boolean(chatId) && !canEditChat)
                      }
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setAttachmentHint(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      className="min-h-[7.625rem] max-h-40 flex-1 resize-none bg-transparent py-2 text-sm leading-snug text-neutral-900 outline-none placeholder:text-fg-neutral-secondary placeholder:font-normal disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => send()}
                      disabled={
                        isStreaming ||
                        createChat.isPending ||
                        (Boolean(chatId) && !canEditChat) ||
                        (!draft.trim() && pendingAttachments.length === 0)
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-200 disabled:opacity-35"
                      aria-label="Send"
                    >
                      <SendIcon />
                    </button>
                  </div>
                </div>

                <div className="flex justify-center items-center gap-3">
                  {[
                    "What time does Hunan close today?",
                    "Plan my Fall 26 schedule",
                    "Navigate me from Tepper to Rotunda Hall",
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setDraft(s);
                        draftComposerRef.current?.focus();
                      }}
                      className="whitespace-nowrap flex items-center justify-center gap-2 rounded-[6.25rem] bg-neutral-secondary-enabled px-4 py-[0.5625rem] text-sm font-semibold text-fg-neutral-primary hover:bg-neutral-200 shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          {showMessagesLoading ? (
            <p className="text-neutral-500 text-sm">Loading messages…</p>
          ) : null}
          {shouldShowConversation && !showMessagesLoading && (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-neutral-200 px-4 py-2.5 text-sm leading-relaxed text-neutral-900">
                      <div className={userBubbleMarkdownClass}>
                        <ReactMarkdown
                          remarkPlugins={remarkMarkdownPlugins}
                          rehypePlugins={rehypeMarkdownPlugins}
                          components={userMarkdownComponents}
                        >
                          {markdownForReactComponent(m.content)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className={markdownClass}>
                    <ReactMarkdown
                      remarkPlugins={remarkMarkdownPlugins}
                      rehypePlugins={rehypeMarkdownPlugins}
                      components={markdownComponents}
                    >
                      {markdownForReactComponent(
                        assistantDisplayContent(m.content, m.cmuMaps),
                      )}
                    </ReactMarkdown>
                    {typeof m.confidence === "number" && m.confidence < 0.5 && (
                      <p className="mt-2 text-xs text-amber-700">
                        Low confidence — verify with an official CMU source.
                      </p>
                    )}
                    <CmuMapsLink cmuMaps={m.cmuMaps} />
                  </div>
                ),
              )}
              {shouldShowOptimisticUserMessage && optimisticUserMessage ? (
                <div key="optimistic-user-message" className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-neutral-200 px-4 py-2.5 text-sm leading-relaxed text-neutral-900">
                    <div className={userBubbleMarkdownClass}>
                      <ReactMarkdown
                        remarkPlugins={remarkMarkdownPlugins}
                        rehypePlugins={rehypeMarkdownPlugins}
                        components={userMarkdownComponents}
                      >
                        {markdownForReactComponent(
                          optimisticUserMessage.content,
                        )}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : null}
              {isStreaming && !streamingText && (
                <StreamingStatus text={streamStatus ?? "Thinking..."} />
              )}
              {isStreaming && streamingText.length > 0 && (
                <div className={markdownClass}>
                  <ReactMarkdown
                    remarkPlugins={remarkMarkdownPlugins}
                    rehypePlugins={rehypeMarkdownPlugins}
                    components={markdownComponents}
                  >
                    {markdownForReactComponent(streamingText, {
                      streaming: true,
                    })}
                  </ReactMarkdown>
                </div>
              )}
              {/* Single stable slot for the active CMU Maps iframe — same
                  DOM position across streaming/done transitions so the
                  iframe doesn't remount and reload. */}
              <CmuMapsEmbed cmuMaps={activeCmuMaps} />
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className=" bg-white px-4 pb-5 pt-3">
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="image/*,text/*,.md,.json,.csv,.ts,.tsx,.jsx,.js,.mjs,.cjs,.yml,.yaml,.toml,.xml,.html,.htm,.css,.rs,.go,.java,.kt,.swift,.py,.rb,.php,.sh,.env,application/json"
            multiple={true}
            onChange={onAttachmentFilesSelected}
          />
          <div className="mx-auto max-w-3xl">
            {pendingAttachments.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {pendingAttachments.map((p) => (
                  <li
                    key={p.id}
                    className="flex max-w-full items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-0.5 pl-0.5 pr-1 text-xs text-neutral-700"
                  >
                    {p.previewUrl ? (
                      <img
                        src={p.previewUrl}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-medium text-neutral-600">
                        {fileExtension(p.file.name).slice(0, 3) || "file"}
                      </span>
                    )}
                    <span className="max-w-[140px] truncate sm:max-w-[200px]">
                      {p.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(p.id)}
                      className="shrink-0 rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
                      aria-label={`Remove ${p.file.name}`}
                    >
                      x
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attachmentHint != null && attachmentHint !== "" && (
              <p className="mb-2 text-center text-xs text-red-600">
                {attachmentHint}
              </p>
            )}
          </div>
          {shouldShowConversation ||
            chatsLoading ||
            (isNewChatIntent && (
              <>
                <div className="mx-auto flex max-w-3xl flex-col gap-[0.625rem] rounded-[1.875rem] border-0 bg-white px-6 py-4 shadow-[0_0_24px_0_var(--color-brandneutral-secondary-enabled),0_0_6px_0_rgba(158,177,194,0.55)]">
                  {/* <button
                  type="button"
                  onClick={openAttachmentPicker}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-35"
                  aria-label="Attach files"
                  disabled={isStreaming || (Boolean(chatId) && !canEditChat)}
                >
                  <svg
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    aria-hidden={true}
                  >
                    <title>Add attachment</title>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button> */}
                  <div className="flex items-end gap-1 sm:gap-2">
                    <textarea
                      ref={draftComposerRef}
                      rows={1}
                      placeholder="How can I help you today?"
                      value={draft}
                      disabled={
                        isStreaming || (Boolean(chatId) && !canEditChat)
                      }
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setAttachmentHint(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      className="max-h-40 min-h-[7.625rem] flex-1 resize-none bg-transparent py-2 text-sm leading-snug text-neutral-900 outline-none placeholder:text-fg-neutral-secondary placeholder:font-normal disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => send()}
                      disabled={
                        isStreaming ||
                        createChat.isPending ||
                        (Boolean(chatId) && !canEditChat) ||
                        (!draft.trim() && pendingAttachments.length === 0)
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-200 disabled:opacity-35"
                      aria-label="Send"
                    >
                      <SendIcon />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-center font-medium text-fg-neutral-tertiary pt-4">
                  CMUGPT is AI and can make mistakes. Please double-check
                  responses.
                </p>
                {streamError != null && streamError !== "" && (
                  <p className="mx-auto mt-2 max-w-3xl text-center text-red-600 text-xs">
                    {streamError}
                  </p>
                )}
              </>
            ))}
        </div>
        {/* Modal (Settings + About Popup) */}
        {Boolean(activeModal) && (
          <button
            type="button"
            aria-label="Close modal"
            className="fixed inset-0 flex items-center justify-center bg-[rgba(245,245,245,0.75)] backdrop-blur-[3.55px] w-full"
            onClick={() => setActiveModal(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setActiveModal(null);
            }}
          >
            <div
              role="dialog"
              className={`relative rounded-2xl bg-white p-6 shadow-xl w-[45.5625rem] ${activeModal === "settings" ? "h-[20rem]" : "h-[30rem]"}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl pt-4 pl-4 font-semibold leading-8">
                  {activeModal === "settings" ? "Settings" : "About CMUGPT"}
                </h2>
                <button type="button" onClick={() => setActiveModal(null)}>
                  <CloseIcon />
                </button>
              </div>

              {activeModal === "settings" && (
                <>
                  <div className="border-b border-neutral-200 pb-3 mb-3 flex items-center justify-between">
                    <span className="text-sm">Language</span>
                    <select className="text-sm text-neutral-600 border border-neutral-200 rounded px-2 py-1">
                      <option>Auto-detect</option>
                    </select>
                  </div>
                  <p className="text-sm font-medium mb-2">Tools</p>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs">
                      CMUMaps
                    </span>
                    <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs">
                      CMUCourses
                    </span>
                    <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs">
                      CMUEats
                    </span>
                  </div>
                </>
              )}

              {activeModal === "about" && (
                <>
                  <p className="text-sm text-black pl-4 font-normal">
                    CMUGPT is an AI tool for CMU community ..... made by
                    Scottylabs...........
                  </p>
                  <div className="flex items-center justify-end gap-2 mt-[19rem] mr-4">
                    <p className="text-base font-medium text-black">
                      With love,
                    </p>
                    <button
                      type="button"
                      className="rounded-[6.25rem] px-3.5 py-1"
                      style={{
                        background: "white",
                        border: "2px solid transparent",
                        backgroundImage:
                          "linear-gradient(white, white), linear-gradient(to bottom, #2B0D77, #29DAFA, #29DAFA, #FC1833)",
                        backgroundOrigin: "border-box",
                        backgroundClip: "padding-box, border-box",
                      }}
                    >
                      <span className="text-sm font-semibold text-fg-neutral-primary">
                        ScottyLabs
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </button>
        )}
      </main>
    </div>
  );
}
