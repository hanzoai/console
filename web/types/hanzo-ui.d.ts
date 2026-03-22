// Type declarations for @hanzo/ui
// The @hanzo/ui package does not ship index.d.ts for the main entry.
// This shim provides correct types until the package build is fixed.
// Components are re-exported from shadcn/ui primitives built on Radix UI.

declare module "@hanzo/ui" {
  import type * as React from "react";
  import type { VariantProps } from "class-variance-authority";

  // --- Accordion ---
  export const Accordion: React.ComponentType<any>;
  export const AccordionItem: React.ComponentType<any>;
  export const AccordionTrigger: React.ComponentType<any>;
  export const AccordionContent: React.ComponentType<any>;

  // --- Alert ---
  export const Alert: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLDivElement> & { variant?: string } & React.RefAttributes<HTMLDivElement>
  >;
  export const AlertTitle: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLHeadingElement> & React.RefAttributes<HTMLParagraphElement>
  >;
  export const AlertDescription: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>
  >;
  export const AlertAction: React.ComponentType<any>;
  export function alertVariants(props?: any): string;

  // --- Alert Dialog ---
  export const AlertDialog: React.ComponentType<any>;
  export const AlertDialogTrigger: React.ComponentType<any>;
  export const AlertDialogContent: React.ComponentType<any>;
  export const AlertDialogHeader: React.ComponentType<any>;
  export const AlertDialogTitle: React.ComponentType<any>;
  export const AlertDialogDescription: React.ComponentType<any>;
  export const AlertDialogFooter: React.ComponentType<any>;
  export const AlertDialogAction: React.ComponentType<any>;
  export const AlertDialogCancel: React.ComponentType<any>;

  // --- Avatar ---
  export const Avatar: React.ComponentType<any>;
  export const AvatarImage: React.ComponentType<any>;
  export const AvatarFallback: React.ComponentType<any>;

  // --- Badge ---
  export const Badge: React.ComponentType<any>;
  export function badgeVariants(props?: any): string;

  // --- Breadcrumb ---
  export const Breadcrumb: React.ForwardRefExoticComponent<any>;
  export const BreadcrumbList: React.ForwardRefExoticComponent<any>;
  export const BreadcrumbItem: React.ForwardRefExoticComponent<any>;
  export const BreadcrumbLink: React.ForwardRefExoticComponent<any>;
  export const BreadcrumbPage: React.ForwardRefExoticComponent<any>;
  export const BreadcrumbSeparator: React.ComponentType<any>;
  export const BreadcrumbEllipsis: React.ComponentType<any>;

  // --- Button ---
  export const Button: React.ForwardRefExoticComponent<any>;
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    isLoading?: boolean;
    variant?: string;
    size?: string;
  }
  export function buttonVariants(props?: any): string;

  // --- Calendar ---
  export const Calendar: React.ComponentType<any>;

  // --- Card ---
  export const Card: React.ComponentType<any>;
  export const CardHeader: React.ComponentType<any>;
  export const CardFooter: React.ComponentType<any>;
  export const CardTitle: React.ComponentType<any>;
  export const CardAction: React.ComponentType<any>;
  export const CardDescription: React.ComponentType<any>;
  export const CardContent: React.ComponentType<any>;

  // --- Carousel ---
  export const Carousel: React.ComponentType<any>;
  export const CarouselContent: React.ComponentType<any>;
  export const CarouselItem: React.ComponentType<any>;
  export const CarouselNext: React.ComponentType<any>;
  export const CarouselPrevious: React.ComponentType<any>;

  // --- Checkbox ---
  export const Checkbox: React.ForwardRefExoticComponent<any>;

  // --- Collapsible ---
  export const Collapsible: React.ComponentType<any>;
  export const CollapsibleTrigger: React.ComponentType<any>;
  export const CollapsibleContent: React.ComponentType<any>;

  // --- Command ---
  export const Command: React.ComponentType<any>;
  export const CommandDialog: React.ComponentType<any>;
  export const CommandInput: React.ComponentType<any>;
  export const CommandList: React.ComponentType<any>;
  export const CommandEmpty: React.ComponentType<any>;
  export const CommandGroup: React.ComponentType<any>;
  export const CommandItem: React.ComponentType<any>;
  export const CommandShortcut: React.ComponentType<any>;
  export const CommandSeparator: React.ComponentType<any>;

  // --- Dialog ---
  export const Dialog: React.ComponentType<any>;
  export const DialogClose: React.ComponentType<any>;
  export const DialogPortal: React.ComponentType<any>;
  export const DialogOverlay: React.ComponentType<any>;
  export const DialogTrigger: React.ComponentType<any>;
  export const DialogContent: React.ComponentType<any>;
  export const DialogHeader: React.ComponentType<any>;
  export const DialogFooter: React.ComponentType<any>;
  export const DialogTitle: React.ComponentType<any>;
  export const DialogDescription: React.ComponentType<any>;

  // --- Drawer ---
  export const Drawer: React.ComponentType<any>;
  export const DrawerPortal: React.ComponentType<any>;
  export const DrawerOverlay: React.ComponentType<any>;
  export const DrawerTrigger: React.ComponentType<any>;
  export const DrawerClose: React.ComponentType<any>;
  export const DrawerHandle: React.ComponentType<any>;
  export const DrawerContent: React.ComponentType<any>;
  export const DrawerHeader: React.ComponentType<any>;
  export const DrawerFooter: React.ComponentType<any>;
  export const DrawerTitle: React.ComponentType<any>;
  export const DrawerDescription: React.ComponentType<any>;

  // --- Dropdown Menu ---
  export const DropdownMenu: React.ComponentType<any>;
  export const DropdownMenuTrigger: React.ComponentType<any>;
  export const DropdownMenuContent: React.ComponentType<any>;
  export const DropdownMenuItem: React.ComponentType<any>;
  export const DropdownMenuCheckboxItem: React.ComponentType<any>;
  export const DropdownMenuRadioItem: React.ComponentType<any>;
  export const DropdownMenuLabel: React.ComponentType<any>;
  export const DropdownMenuSeparator: React.ComponentType<any>;
  export const DropdownMenuShortcut: React.ComponentType<any>;
  export const DropdownMenuGroup: React.ComponentType<any>;
  export const DropdownMenuPortal: React.ComponentType<any>;
  export const DropdownMenuSub: React.ComponentType<any>;
  export const DropdownMenuSubContent: React.ComponentType<any>;
  export const DropdownMenuSubTrigger: React.ComponentType<any>;
  export const DropdownMenuRadioGroup: React.ComponentType<any>;

  // --- Hover Card ---
  export const HoverCard: React.ComponentType<any>;
  export const HoverCardTrigger: React.ComponentType<any>;
  export const HoverCardContent: React.ComponentType<any>;

  // --- Input ---
  export const Input: React.ComponentType<any>;

  // --- Label ---
  export const Label: React.ForwardRefExoticComponent<any>;

  // --- Popover ---
  export const Popover: React.ComponentType<any>;
  export const PopoverAnchor: React.ComponentType<any>;
  export const PopoverClose: React.ComponentType<any>;
  export const PopoverContent: React.ForwardRefExoticComponent<any>;
  export const PopoverTrigger: React.ComponentType<any>;

  // --- Progress ---
  export const Progress: React.ForwardRefExoticComponent<any>;

  // --- Radio Group ---
  export const RadioGroup: React.ForwardRefExoticComponent<any>;
  export const RadioGroupItem: React.ForwardRefExoticComponent<any>;

  // --- Resizable ---
  export const ResizablePanelGroup: React.ComponentType<any>;
  export const ResizablePanel: React.ComponentType<any>;
  export const ResizableHandle: React.ComponentType<any>;

  // --- Scroll Area ---
  export const ScrollArea: React.ForwardRefExoticComponent<any>;
  export const ScrollBar: React.ForwardRefExoticComponent<any>;

  // --- Select ---
  export const Select: React.ComponentType<any>;
  export const SelectGroup: React.ComponentType<any>;
  export const SelectValue: React.ComponentType<any>;
  export const SelectTrigger: React.ComponentType<any>;
  export const SelectContent: React.ComponentType<any>;
  export const SelectLabel: React.ComponentType<any>;
  export const SelectItem: React.ComponentType<any>;
  export const SelectSeparator: React.ComponentType<any>;

  // --- Separator ---
  export const Separator: React.ForwardRefExoticComponent<any>;

  // --- Sheet ---
  export const Sheet: React.ComponentType<any>;
  export const SheetPortal: React.ComponentType<any>;
  export const SheetOverlay: React.ComponentType<any>;
  export const SheetTrigger: React.ComponentType<any>;
  export const SheetClose: React.ComponentType<any>;
  export const SheetContent: React.ComponentType<any>;
  export const SheetHeader: React.ComponentType<any>;
  export const SheetFooter: React.ComponentType<any>;
  export const SheetTitle: React.ComponentType<any>;
  export const SheetDescription: React.ComponentType<any>;

  // --- Skeleton ---
  export function Skeleton(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element;

  // --- Slider ---
  export const Slider: React.ForwardRefExoticComponent<any>;

  // --- Switch ---
  export const Switch: React.ForwardRefExoticComponent<any>;

  // --- Table ---
  export const Table: React.ForwardRefExoticComponent<any>;
  export const TableHeader: React.ForwardRefExoticComponent<any>;
  export const TableBody: React.ForwardRefExoticComponent<any>;
  export const TableFooter: React.ForwardRefExoticComponent<any>;
  export const TableHead: React.ForwardRefExoticComponent<any>;
  export const TableRow: React.ForwardRefExoticComponent<any>;
  export const TableCell: React.ForwardRefExoticComponent<any>;
  export const TableCaption: React.ForwardRefExoticComponent<any>;

  // --- Tabs ---
  export const Tabs: React.ComponentType<any>;
  export const TabsList: React.ForwardRefExoticComponent<any>;
  export const TabsTrigger: React.ForwardRefExoticComponent<any>;
  export const TabsContent: React.ForwardRefExoticComponent<any>;
  export function tabsListVariants(props?: any): string;

  // --- Textarea ---
  export const Textarea: React.ForwardRefExoticComponent<
    React.TextareaHTMLAttributes<HTMLTextAreaElement> & React.RefAttributes<HTMLTextAreaElement>
  >;

  // --- Toggle ---
  export const Toggle: React.ForwardRefExoticComponent<any>;
  export function toggleVariants(props?: any): string;

  // --- Toggle Group ---
  export const ToggleGroup: React.ForwardRefExoticComponent<any>;
  export const ToggleGroupItem: React.ForwardRefExoticComponent<any>;

  // --- Tooltip ---
  export const TooltipProvider: React.ComponentType<any>;
  export const Tooltip: React.ComponentType<any>;
  export const TooltipTrigger: React.ComponentType<any>;
  export const TooltipContent: React.ForwardRefExoticComponent<any>;
  export const TooltipArrow: React.ComponentType<any>;
  export const TooltipPortal: React.ComponentType<any>;

  // --- Sonner ---
  export const Toaster: React.ComponentType<any>;
  export function toast(...args: any[]): any;

  // --- Utilities ---
  export function cn(...inputs: any[]): string;
}
