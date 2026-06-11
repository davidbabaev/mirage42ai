import { Link, Route, Routes } from "react-router-dom";
import AdminUsersPanel from "../AdminUsersPanel";
import AdminOverViewPanel from "../AdminOverViewPanel";
import AdminCardsPanel from "../AdminCardsPanel";
import { useState } from "react";
import AdminNavBar from "./AdminNavBar";
import { Box } from "@mui/material";
import AdminSideBar from "./AdminSideBar";

export default function AdminDashboardLayout() {
  
  const [isSideBarOpen, setIsSideBarOpen] = useState(false);

  return(

      <Box>
        <AdminNavBar onToggle={() => setIsSideBarOpen(!isSideBarOpen)}/>

        <Box sx={{display: 'flex'}}>
            <AdminSideBar isOpen={isSideBarOpen}/>

            <Box sx={{flex: 1, overflow: 'auto'}}>
              <Routes>
                <Route path="/userspanel" element={<AdminUsersPanel/>}/>
                <Route path="/overviewpanel" element={<AdminOverViewPanel/>}/>
                <Route path="/cardspanel" element={<AdminCardsPanel/>}/>
              </Routes>

            </Box>
        </Box>
      </Box>
  )
}
