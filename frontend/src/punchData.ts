export type PunchItemData = {
  id: number
  title: string
  description: string
  location: string
  drawing: string
  assignedTo: string
  priority: string
  status: string
}

export const punchItems: PunchItemData[] = [
  {
    id: 1,
    title: "Electrical Outlet Issue",
    description: "Electrical outlet is not properly installed and needs to be inspected and repaired.",
    location: "Room 101",
    drawing: "A-101",
    assignedTo: "Unassigned",
    priority: "High",
    status: "Open"
  },
  {
    id: 2,
    title: "Wall Paint Needs Repair",
    description: "Wall paint needs to be repaired.",
    location: "Room 305",
    drawing: "A-101",
    assignedTo: "Kiishi",
    priority: "Medium",
    status: "In Progress"
  },
  {
    id: 3,
    title: "Door Hardware Missing",
    description: "Door hardware is missing and needs to be installed.",
    location: "Room 112",
    drawing: "A-102",
    assignedTo: "Thierno",
    priority: "Low",
    status: "Completed"
  }
]