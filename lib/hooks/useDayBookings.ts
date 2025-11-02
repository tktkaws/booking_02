import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { BookingWithDepartment } from "@/types/booking";

interface UseDayBookingsOptions {
  excludeId?: number | null;
}

export function useDayBookings(date: string | null, options: UseDayBookingsOptions = {}) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [bookings, setBookings] = useState<BookingWithDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(
    async (currentDate: string | null) => {
      if (!currentDate) {
        setBookings([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const start = new Date(`${currentDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, title, description, start_at, end_at, is_companywide, department_id, departments(name, default_color)"
        )
        .gte("start_at", start.toISOString())
        .lt("start_at", end.toISOString())
        .order("start_at", { ascending: true });
      setLoading(false);
      if (error) {
        setError(error.message);
        setBookings([]);
        return;
      }
      const filtered = ((data as BookingWithDepartment[]) ?? []).filter((b) => {
        if (!options.excludeId) return true;
        return b.id !== options.excludeId;
      });
      setBookings(filtered);
    },
    [options.excludeId, supabase]
  );

  useEffect(() => {
    fetchBookings(date ?? null);
  }, [date, fetchBookings]);

  useEffect(() => {
    function handleUpdate() {
      fetchBookings(date ?? null);
    }
    window.addEventListener("bookings-updated", handleUpdate as EventListener);
    return () => {
      window.removeEventListener("bookings-updated", handleUpdate as EventListener);
    };
  }, [date, fetchBookings]);

  return { bookings, loading, error, refresh: fetchBookings };
}
