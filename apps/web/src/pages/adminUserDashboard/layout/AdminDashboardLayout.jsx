import { Link, Route, Routes } from "react-router-dom";
import AdminUsersPanel from "../AdminUsersPanel";
import AdminOverviewPanel from "../AdminOverviewPanel";
import AdminCardsPanel from "../AdminCardsPanel";
import AdminAnalyticsProvider from "../AdminAnalyticsProvider";
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
                {/* The analytics dataset (all users + all cards) is fetched when THIS
                    panel mounts — admin-only, on demand — instead of being loaded at
                    app mount for every visitor by the global providers. */}
                <Route path="/overviewpanel" element={
                  <AdminAnalyticsProvider>
                    <AdminOverviewPanel/>
                  </AdminAnalyticsProvider>
                }/>
                <Route path="/cardspanel" element={<AdminCardsPanel/>}/>
              </Routes>

            </Box>
        </Box>
      </Box>
  )
}
