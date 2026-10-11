"use client";

import dynamic from "next/dynamic";

// The form uses Leaflet, FileReader and localStorage — render it on the client only.
const AddForm = dynamic(() => import("@/components/add/AddForm").then((m) => m.AddForm), {
  ssr: false,
  loading: () => <div className="mx-auto h-[60vh] max-w-[820px] animate-pulse rounded-[16px] bg-line-2" />,
});

export default function AddPage() {
  return <AddForm />;
}
