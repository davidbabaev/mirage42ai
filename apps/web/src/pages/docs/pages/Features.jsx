import React from 'react'
import { Box, Divider, List, ListItem, ListItemIcon, ListItemText, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import CardDocs from '../components/CardDocs';
import CheckIcon from '@mui/icons-material/Check';
import RemoveIcon from '@mui/icons-material/Remove';

export default function Features() {

  const authentication = [
    {text: 'Email/password registration with full profile setup (name, country, city, job, gender, birth date, phone, about me)'},
    {text: 'Email/password login'},
    {text: 'Google OAuth — sign in or register with a Google account'},
    {text: 'JWT-based session (token stored in localStorage)'},
    {text: 'Birth date enforcement: must be 13 or older'},
    {text: 'Phone validation (10-digit limit)'},
  ];
  
  const publicProfile = [
    {label: 'Posts' ,text: 'all posts the user has published, sorted newest first'},
    {label: 'About' ,text: 'bio, job, location, age, gender, birth date, join date'},
    {label: 'Media' ,text: 'grid view of all media (images/videos) the user has posted'},
    {label: 'Followers' ,text: 'users who follow this person'},
    {label: 'Following' ,text: 'users this person follows'},
    {label: 'Mutual friends' ,text: 'users that both you and this person follow (on profile sidebar)'},
    {label: 'Make new friends' ,text: "users this person follows that you don't yet (suggestions)"},
    {label: 'Follow/ unfollow' ,text: 'action'},
    {label: 'Save to favorites' ,text: '(private — only you see your favorites)'},
    {label: 'Message' ,text: 'jumps to chat with this user'},
  ];

  const feed = [
    {label: 'Following feed' ,text: 'posts from people you follow, sorted by recency'},
    {label: 'Profile sidebar' ,text: 'your avatar, name, job, location, follower/following/post counts, quick links'},
    {label: 'People you may know' ,text: 'suggested users (friends-of-friends) with one-click follow'},
    {label: 'Create post trigger' ,text: 'start a new post directly from the feed'},
  ];

  const createPost = [
    {text: 'Pick a single media file (image or video, your choice — Cloudinary handles upload)'},
    {text: 'Optional title'},
    {text: 'Pick category from a curated list (50+ options)'},
    {text: 'Body text with emoji picker'},
    {text: 'Optional external URL link'},
    {text: 'Live preview of media before posting'},
  ];

  const allUsers = [
    {text: 'Search by name (debounced)'},
    {text: 'Filter by country (with per-country user counts)'},
    {text: 'Sort by age (youngest / oldest)'},
    {text: 'Sort by name (A → Z, Z → A)'},
    {text: 'Filter by gender'},
    {text: 'Save user to favorites directly from the grid card'},
    {text: 'Follow/unfollow directly from the grid card'},
    {text: 'Load more pagination'},
    {text: 'Mobile: filter panel as full-screen drawer'},
  ];

  const allPosts = [
    {label: 'Search', text: 'find posts by title, text, category, or creator name (debounced)'},
    {label: 'Sort', text: 'newest, oldest, most liked, or most commented'},
    {label: 'Filter by category', text: 'multi-select from 50+ categories, with per-category post counts; empty categories are disabled'},
    {label: 'Filter by creator', text: 'searchable list of all creators; pick one to see only their posts'},
    {label: 'Show toggle', text: 'all posts vs your favorite posts only'},
    {label: 'Active filters', text: 'each active filter shown as a removable chip; "Clear all" button when any filter is on'},
    {label: 'Load more', text: 'pagination — loads 10 more posts at a time'},
    {label: 'Click post', text: 'opens the full post modal with media, comments, likes, save (same as feed)'},
    {label: 'Mobile', text: 'filter panel slides in as a full-screen drawer; toggle with the filter icon'},
  ];

  const postInteractions = [
    {label: 'Like / unlike',text: 'overlapping avatars show who liked it'},
    {label: 'Save / unsave',text: 'to your favorites'},
    {label: 'Comment',text: "add comments, see all comments with the commenter's avatar and quick-follow button"},
    {label: 'Delete comment',text: "your own comments, or any comment on a post you authored, or any comment if you're admin"},
    {label: 'Read more/ show less',text: 'for long post text (collapsed at 150 characters)'},
    {label: 'Visit link',text: 'button if the post has a URL attached'},
    {label: 'Click to expand',text: 'opens a full-screen modal showing the post in detail with media, full text, comments thread, and full action set'},
    {label: 'Click avatar/ name',text: "anywhere → navigate to that user's profile"},
  ];

  const realTimeChat = [
    {text: 'WebSocket-based — messages arrive instantly without refresh'},
    {text: 'One conversation per user pair (no duplicates)'},
    {text: 'Send text messages'},
    {text: 'Send images and videos through the chat (uploaded to Cloudinary, persisted to MongoDB)'},
    {text: 'Emoji picker in the message input'},
    {text: 'Delete a conversation — deletes for both participants and broadcasts the removal to the other user in real time'},
    {text: 'Conversation list sorted by most recent activity'},
    {text: 'Mobile: WhatsApp-style layout — conversation list collapses when a chat is open; back arrow returns to the list'},
  ];

  const notifications = [
    {text: 'Real-time notifications on: follows, likes, comments'},
    {text: 'Unread badge count on the navbar bell icon'},
    {text: 'Auto-marked as read when the dropdown opens'},
    {text: 'Delete individual notifications'},
    {text: "Click a notification to jump to the actor's profile"},
  ];

  const theme = [
    {text: 'Light mode / dark mode toggle'},
    {text: 'Persists across the entire app (MUI theming)'},
  ];

  const overviewDashboard = [
    {label: 'Headline stats', text: 'total users, total posts, total likes, total comments, average engagement per post'},
    {label: 'User registration over time', text: 'area chart by month'},
    {label: 'Logged in this month', text: 'count + sparkline of daily activity'},
    {label: 'Retention metrics', text: 'logged in today vs yesterday (with growth %), registered this week vs last week, weekly active users vs previous week, retention rate (registered last week and active this week)'},
    {label: 'Most popular', text: 'most active user, most-liked post'},
    {label: 'Last 5 joined users', text: 'with follow buttons'},
    {label: 'Top 10 active users', text: 'horizontal bar chart by post count'},
    {label: 'Users by country', text: 'list with flags and percentage bars'},
    {label: 'Gender distribution', text: 'donut chart with totals'},
    {label: 'Gender by age range', text: 'stacked bar chart (Male/Female across age buckets)'},
    {label: 'Top 10 categories', text: 'donut chart'},
    {label: 'Posts per category', text: 'expandable list with counts'},
    {label: 'Top 5 posts', text: 'by likes + comments engagement'},
    {label: 'Last 5 posts', text: 'most recently published'},
  ];

  const usersTable = [
    {text: 'Pagination (page size: 10 / 25 / 50 / 100)'},
    {text: 'Search by name'},
    {text: 'Filter by gender, country, role (admin / regular)'},
    {text: 'Sort by age (low → high or reverse)'},
    {text: 'Sort by name (A → Z or reverse)'},
    {text: 'Sortable columns: joined date, post count, follower count'},
    {text: 'Each row shows: avatar, full name, email, last login, country flag, joined date, posts, followers, role badge, status badge (active / banned)'},
    {label: 'Ban / unban', text: 'action'},
    {label: 'Promote/ demote', text: 'to admin (admins can grant admin to anyone)'},
    {label: 'Delete user', text: "cascades and removes all of that user's content (posts, comments, likes, follows, chats, notifications)"},
  ];

  const postsTable = [
    {text: 'Pagination (page size: 10 / 25 / 50 / 100)'},
    {text: 'Search by title'},
    {text: 'Filter by creator, category, "my favorites"'},
    {text: 'Sortable columns: created date, likes count, category, creator name'},
    {text: 'Each row: thumbnail, creator info, title, category, created date, likes, comments, status badge (active / banned)'},
    {label: 'Ban / unban', text: 'action — banned posts are hidden from non-admin views'},
    {label: 'Delete post ', text: 'cascades and removes the post, its likes, comments, and any related notifications'},
    {label: 'Click row →', text: 'preview post in a full modal'},
  ];

  const uxAndPolish = [
    {text: 'Skeleton loaders during async data fetches'},
    {text: 'Confirmation dialogs before destructive actions (delete user, delete post, etc.)'},
    {text: 'Login popup nudges guests to sign up when they try to interact'},
    {text: '404 page for unmatched routes'},
    {text: 'Mobile-responsive layouts across every page'},
    {text: 'Fixed top navbar on desktop, fixed bottom navbar on mobile'},
    {text: 'Auto-hiding mobile bottom bar on scroll'},
    {text: 'Rotate-to-portrait overlay for landscape phones (mobile is portrait-first)'},
  ];

  const privateDashboard = [
    {label: 'Profile', text: 'view your own info; edit any field (name, last name, country, city, job, gender, birth date, phone, about me, profile picture, banner image). Country and city are cascading dropdowns powered by a country/cities API'},
    {label: 'My posts', text: 'all your posts; edit any field on any post (title, category, text, URL, media), or delete the post'},
    {label: 'Favorite users', text: 'users you saved (private to you)'},
    {label: 'Favorite posts', text: 'posts you saved (private to you)'},
    {text: 'Profile completeness alert — banner that nudges you to fill in missing fields'},
  ];

  const permissions = [
    // Browsing
    {action: 'View feed (/)',                          guest: false, user: true, admin: true},
    {action: 'Browse all posts (/allcards)',           guest: true,  user: true, admin: true},
    {action: 'Browse all users (/allusers)',           guest: true,  user: true, admin: true},
    {action: 'View any user profile',                  guest: true,  user: true, admin: true},
    {action: 'View post details',                      guest: true,  user: true, admin: true},
    {action: 'View landing & docs (/about, /docs)',    guest: true,  user: true, admin: true},

    // Interactions
    {action: 'Like / unlike a post',                   guest: false, user: true, admin: true},
    {action: 'Comment on a post',                      guest: false, user: true, admin: true},
    {action: 'Save post / user to favorites',          guest: false, user: true, admin: true},
    {action: 'Follow / unfollow users',                guest: false, user: true, admin: true},
    {action: 'Send messages (chat)',                   guest: false, user: true, admin: true},

    // Own content
    {action: 'Create post',                            guest: false, user: true, admin: true},
    {action: 'Edit own post',                          guest: false, user: true, admin: true},
    {action: 'Delete own post',                        guest: false, user: true, admin: true},
    {action: 'Edit own profile',                       guest: false, user: true, admin: true},
    {action: 'Delete own account',                     guest: false, user: true, admin: false},
    {action: 'Delete own comment',                     guest: false, user: true, admin: true},
    {action: 'Delete any comment on own post',         guest: false, user: true, admin: true},

    // Moderation (admin-only)
    {action: 'Access admin dashboard',                 guest: false, user: false, admin: true},
    {action: 'Delete any user',                        guest: false, user: false, admin: true},
    {action: 'Ban / unban any user',                   guest: false, user: false, admin: true},
    {action: 'Promote / demote any user',              guest: false, user: false, admin: true},
    {action: 'Delete any post',                        guest: false, user: false, admin: true},
    {action: 'Ban / unban any post',                   guest: false, user: false, admin: true},
    {action: 'Delete any comment',                     guest: false, user: false, admin: true},
  ];



  return (
    <Box sx={{display: 'flex', flexDirection: 'column'}}>
      <Box sx={{display:'flex', gap: 5, flexDirection: 'column'}}>
        <CardDocs
          title={'Authentication'}
          array={authentication}
        />

        <CardDocs
          title={'Public Profile'}
          array={publicProfile}
        />

        <CardDocs
          title={'Feed'}
          array={feed}
        />

        <CardDocs
          title={'Create post'}
          array={createPost}
        />

        <CardDocs
          title={'Private dashboard'}
          array={privateDashboard}
        />

        <CardDocs
          title={'All users (/allusers)'}
          array={allUsers}
        />

        <CardDocs
          title={'All posts (/allcards)'}
          array={allPosts}
        />

        <CardDocs
          title={'Post interactions'}
          array={postInteractions}
        />

        <CardDocs
          title={'Real-time chat (Socket.IO)'}
          array={realTimeChat}
        />

        <CardDocs
          title={'Notifications'}
          array={notifications}
        />

        <CardDocs
          title={'Theming'}
          array={theme}
        />

        <CardDocs
          title={'UX & polish'}
          array={uxAndPolish}
        />
      </Box>

      <Divider sx={{my: 3}}/>
      <Typography pb={3} fontSize={20} fontWeight={700}>
        Premissions matrix
      </Typography>

      <TableContainer component={Paper} elevation={3} sx={{borderRadius: 3, p: 3}}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell sx={{fontWeight: 700, fontSize: 14}}>Action</TableCell>
              <TableCell align='center' sx={{fontWeight: 700, fontSize: 14}}>Guest</TableCell>
              <TableCell align='center' sx={{fontWeight: 700, fontSize: 14}}>User</TableCell>
              <TableCell align='center' sx={{fontWeight: 700, fontSize: 14}}>Admin</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {permissions.map((row) => (
              <TableRow key={row.action}>
                <TableCell sx={{fontSize: 14}}>{row.action}</TableCell>
                <TableCell 
                  align='center'
                  sx={{color: row.guest ? 'success.main' : 'text.disabled'}}
                >
                  {row.guest ? <CheckIcon/> : <RemoveIcon/>}
                </TableCell>

                <TableCell 
                  align='center'
                  sx={{color: row.user ? 'success.main' : 'text.disabled'}}
                >
                  {row.user ? <CheckIcon/> : <RemoveIcon/>}
                </TableCell>

                <TableCell 
                  align='center'
                  sx={{color: row.admin ? 'success.main' : 'text.disabled'}}
                >
                  {row.admin ? <CheckIcon/> : <RemoveIcon/>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>


      <Divider sx={{my: 3}}/>
      <Typography pb={3} fontSize={20} fontWeight={700}>Admin panel (admin-only)</Typography>

      <Box sx={{display:'flex', gap: 5, flexDirection: 'column'}}>
        <CardDocs
          title={'Overview dashboard'}
          array={overviewDashboard}
        />
        <CardDocs
          title={'Users table'}
          array={usersTable}
        />
        <CardDocs
          title={'Post table'}
          array={postsTable}
        />
      </Box>
    </Box>
  )
}
