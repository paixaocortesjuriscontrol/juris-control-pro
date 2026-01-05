import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  maxLength?: number;
}

export function MentionInput({
  value,
  onChange,
  placeholder = "Digite seu comentário...",
  rows = 3,
  className,
  maxLength = 2000,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch users for mentions - using profiles_basic view (accessible to all users)
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-mention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredUsers = usuarios?.filter((u) =>
    u.nome?.toLowerCase().includes(mentionSearch.toLowerCase())
  ).slice(0, 5) || [];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    onChange(newValue);

    // Check for @ trigger
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      // Only show suggestions if @ is followed by word characters (no spaces)
      if (!textAfterAt.includes(" ") && textAfterAt.length <= 20) {
        setMentionSearch(textAfterAt);
        setShowSuggestions(true);
        return;
      }
    }
    setShowSuggestions(false);
    setMentionSearch("");
  };

  const handleSelectUser = (user: { id: string; nome: string }) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const newValue =
        textBeforeCursor.slice(0, atIndex) +
        `@${user.nome} ` +
        textAfterCursor;
      onChange(newValue);
    }

    setShowSuggestions(false);
    setMentionSearch("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === "Escape") {
        setShowSuggestions(false);
        e.preventDefault();
      }
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        className={className}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 bottom-full mb-1 left-0 w-full max-w-xs bg-popover border rounded-md shadow-lg overflow-hidden"
        >
          <div className="p-1">
            <p className="text-xs text-muted-foreground px-2 py-1">
              Mencionar usuário
            </p>
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded-sm transition-colors text-left"
                onClick={() => handleSelectUser(user)}
              >
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {user.nome ? getInitials(user.nome) : "?"}
                  </AvatarFallback>
                </Avatar>
                <p className="font-medium truncate">{user.nome}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
