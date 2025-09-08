"use client";

import { useState, useRef, useEffect } from "react";
import { PROMPT_TEMPLATES } from "@/lib/gemini";

export type TemplateOption = {
  id: string;
  name: string;
  icon: string;
};

export default function PromptTemplateSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (templateId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const templates: TemplateOption[] = Object.entries(PROMPT_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    icon: template.icon,
  }));

  const selectedTemplate = templates.find(t => t.id === value) || templates[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        title={`Prompt Template: ${selectedTemplate.name}`}
      >
        <span className="text-base">{selectedTemplate.icon}</span>
        <span className="hidden sm:inline font-medium">{selectedTemplate.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">
              Choose Generation Style
            </div>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  onChange(template.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-blue-50 focus:outline-none focus:bg-blue-50 transition-colors ${
                  value === template.id ? "bg-blue-100 text-blue-900" : "text-gray-700"
                }`}
              >
                <span className="text-lg flex-shrink-0">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{template.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {template.id === "logo" && "Clean, scalable vector designs"}
                    {template.id === "general" && "Photorealistic, detailed images"}
                    {template.id === "artistic" && "Creative, stylized artwork"}
                    {template.id === "product" && "Professional product shots"}
                    {template.id === "portrait" && "Character & facial focus"}
                    {template.id === "landscape" && "Environmental & scenic views"}
                  </div>
                </div>
                {value === template.id && (
                  <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

