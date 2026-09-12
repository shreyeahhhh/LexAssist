import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown, FiGlobe } from "react-icons/fi";
import { uiButton } from "./ui/designTokens";

const LanguageSelect = ({
  value,
  onChange,
  commonLanguages,
  languageMapping,
  wrapperClassName = "",
  selectClassName = "",
  ariaLabel = "Select language",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 250 });

  const updateMenuPosition = () => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(250, rect.width),
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedTrigger = rootRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      if (!clickedTrigger && !clickedMenu) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen]);

  const languageItems = useMemo(
    () =>
      commonLanguages.map((langItem) => {
        const info = languageMapping[langItem.mappingKey] || {};
        return {
          code: langItem.code,
          name: info.name || langItem.code,
          nativeName: info.nativeName || "",
        };
      }),
    [commonLanguages, languageMapping],
  );

  const selectedLanguage =
    languageItems.find((item) => item.code === value) || languageItems[0] || { name: value || "Language", nativeName: "" };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          updateMenuPosition();
          setIsOpen((prev) => !prev);
        }}
        className={`${uiButton.ghost} text-sm px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-inner shadow-black/20 ${wrapperClassName}`.trim()}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <FiGlobe size={15} className="text-white/85 shrink-0" />
        <span className={`text-sm text-white min-w-[110px] text-left ${selectClassName}`.trim()}>
          {selectedLanguage.name}
        </span>
        <FiChevronDown
          size={14}
          className={`text-white/75 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100000] max-h-80 overflow-y-auto rounded-2xl border border-slate-300/80 bg-slate-100 text-slate-800 shadow-2xl"
            style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
          >
            {languageItems.map((item) => {
              const isSelected = item.code === value;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onChange(item.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start justify-between px-4 py-3 text-left transition ${
                    isSelected ? "bg-indigo-100" : "hover:bg-slate-200/70"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[19px] leading-6 font-medium text-slate-700">{item.name}</p>
                    {item.nativeName && item.nativeName !== item.name ? (
                      <p className="text-[15px] leading-5 text-slate-500 mt-0.5">{item.nativeName}</p>
                    ) : null}
                  </div>
                  {isSelected ? <FiCheck className="mt-1 text-indigo-600" size={20} /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      )}
    </div>
  );
};

export default LanguageSelect;
