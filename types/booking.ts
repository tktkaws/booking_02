export interface BookingWithDepartment {
  id: number;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_companywide: boolean;
  department_id: string;
  departments?: {
    name: string;
    default_color?: string | null;
  } | null;
}
