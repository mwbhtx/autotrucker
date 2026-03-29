"use client";

import { DayPicker, useDayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/core/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CustomCaption({ calendarMonth }: { calendarMonth: { date: Date } }) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();
  const label = calendarMonth.date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex items-center justify-between px-1 py-1">
      <button
        type="button"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-white text-black hover:bg-white/80 transition-colors disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-white text-black hover:bg-white/80 transition-colors disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      hideNavigation
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_grid: "w-full border-collapse",
        weekdays: "flex justify-center",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex justify-center w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center",
        day_button:
          "h-9 w-9 p-0 font-normal rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground inline-flex items-center justify-center transition-colors",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        MonthCaption: CustomCaption,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
