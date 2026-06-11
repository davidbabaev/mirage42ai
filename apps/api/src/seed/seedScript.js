require('dotenv').config();

const User = require('../users/models/User');
const Card = require('../cards/models/Card');

const normalizeUser = require('../users/helpers/normalizeUser');
const normalizeCard = require('../cards/helpers/normalizeCard');

const {generateUserPassword} = require('../users/helpers/bcrypt');

const {connectToDB, disconnectDB} = require('../dbService');

const mockUsers = [
    {
        name: "David",
        lastName: "Cohen",
        email: "david@test.com",
        password: "Test1234!",
        phone: "050-1234567",
        age: 28,
        birthDate: "1997-05-12",
        gender: "Male",
        job: "Software Engineer",
        aboutMe: "Full-stack developer who loves building apps",
        profilePicture: "https://avatars.githubusercontent.com/u/126739366?v=4",
        address: { country: "Israel", city: "Tel Aviv", street: "Rothschild", house: 42, zip: 12345 },
        isAdmin: true,
        createdAt: "2025-11-01T10:00:00.000Z",
        lastLoginAt: "2026-03-12T08:00:00.000Z"  // today - DAU
    },
    {
        name: "Sarah",
        lastName: "Levi",
        email: "sarah@test.com",
        password: "Test1234!",
        phone: "052-9876543",
        age: 25,
        birthDate: "2000-08-23",
        gender: "Female",
        job: "Graphic Designer",
        aboutMe: "Visual thinker who speaks in colors and shapes. I design brands that people actually remember.",
        profilePicture: "https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/1939485/pexels-photo-1939485.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Israel", city: "Haifa", street: "Herzl", house: 12, zip: 31000 },
        createdAt: "2025-11-15T10:00:00.000Z",
        lastLoginAt: "2026-03-12T09:30:00.000Z"  // today - DAU
    },
    {
        name: "Mike",
        lastName: "Ross",
        email: "mike@test.com",
        password: "Test1234!",
        phone: "054-5551234",
        age: 32,
        birthDate: "1993-11-07",
        gender: "Male",
        job: "UI/UX Designer",
        aboutMe: "Building digital products that feel human. Obsessed with clean interfaces and good coffee.",
        profilePicture: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "United States", city: "New York", street: "Broadway", house: 100, zip: 10001 },
        createdAt: "2025-12-01T10:00:00.000Z",
        lastLoginAt: "2026-03-12T07:15:00.000Z"  // today - DAU
    },
    {
        name: "Noa",
        lastName: "Mizrahi",
        email: "noa@test.com",
        password: "Test1234!",
        phone: "053-1112233",
        age: 27,
        birthDate: "1998-03-15",
        gender: "Female",
        job: "Marketing Specialist",
        aboutMe: "Marketing specialist obsessed with brand storytelling. If it doesn't connect emotionally, it doesn't work.",
        profilePicture: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Israel", city: "Jerusalem", street: "Jaffa", house: 18, zip: 91000 },
        createdAt: "2025-12-10T10:00:00.000Z",
        lastLoginAt: "2026-03-10T14:00:00.000Z"  // this week - WAU
    },
    {
        name: "Ethan",
        lastName: "Brown",
        email: "ethan@test.com",
        password: "Test1234!",
        phone: "057-4445566",
        age: 30,
        birthDate: "1995-07-22",
        gender: "Male",
        job: "Backend Engineer",
        aboutMe: "Backend engineer who enjoys distributed systems and making things scale. London-based, originally from the US.",
        profilePicture: "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/574071/pexels-photo-574071.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "United Kingdom", city: "London", street: "Baker", house: 22, zip: 10002 },
        createdAt: "2025-12-20T10:00:00.000Z",
        lastLoginAt: "2026-03-08T11:00:00.000Z"  // this week - WAU
    },
    {
        name: "Maya",
        lastName: "Shapiro",
        email: "maya@test.com",
        password: "Test1234!",
        phone: "058-7778899",
        age: 24,
        birthDate: "2001-01-10",
        gender: "Female",
        job: "Photographer",
        aboutMe: "Capturing moments one frame at a time. Natural light, real emotions, no filters.",
        profilePicture: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Israel", city: "Tel Aviv", street: "Dizengoff", house: 55, zip: 64332 },
        createdAt: "2026-01-05T10:00:00.000Z",
        lastLoginAt: "2026-03-07T16:00:00.000Z"  // this week - WAU
    },
    {
        name: "James",
        lastName: "Walker",
        email: "james@test.com",
        password: "Test1234!",
        phone: "050-3334455",
        age: 35,
        birthDate: "1990-09-30",
        gender: "Male",
        job: "Finance Analyst",
        aboutMe: "Finance analyst by day, guitarist by night. Numbers and music have more in common than you'd think.",
        profilePicture: "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Canada", city: "Toronto", street: "King", house: 77, zip: 30301 },
        createdAt: "2026-01-15T10:00:00.000Z",
        lastLoginAt: "2026-03-04T10:00:00.000Z"  // last week
    },
    {
        name: "Lior",
        lastName: "Ben David",
        email: "lior@test.com",
        password: "Test1234!",
        phone: "052-6667788",
        age: 29,
        birthDate: "1996-12-05",
        gender: "Male",
        job: "Cybersecurity Engineer",
        aboutMe: "Making the internet a safer place one bug at a time. CTF player on weekends.",
        profilePicture: "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Israel", city: "Beer Sheva", street: "Rager", house: 10, zip: 84100 },
        createdAt: "2026-01-20T10:00:00.000Z",
        lastLoginAt: "2026-03-03T09:00:00.000Z"  // last week
    },
    {
        name: "Sofia",
        lastName: "Garcia",
        email: "sofia@test.com",
        password: "Test1234!",
        phone: "054-9990011",
        age: 26,
        birthDate: "1999-04-18",
        gender: "Female",
        job: "Teacher",
        aboutMe: "Teacher who believes technology can transform learning. Barcelona born, globally curious.",
        profilePicture: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/256417/pexels-photo-256417.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Spain", city: "Barcelona", street: "Las Ramblas", house: 5, zip: 20001 },
        createdAt: "2026-02-01T10:00:00.000Z",
        lastLoginAt: "2026-03-01T12:00:00.000Z"  // last week
    },
    {
        name: "Omer",
        lastName: "Katz",
        email: "omer@test.com",
        password: "Test1234!",
        phone: "056-2223344",
        age: 31,
        birthDate: "1994-06-25",
        gender: "Male",
        job: "Data Scientist",
        aboutMe: "Turning raw data into stories that drive decisions. Python and espresso are my tools of choice.",
        profilePicture: "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/669615/pexels-photo-669615.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Israel", city: "Ramat Gan", street: "Arlozorov", house: 33, zip: 52521 },
        createdAt: "2026-02-10T10:00:00.000Z",
        lastLoginAt: "2026-02-20T10:00:00.000Z"  // older - inactive
    },
    {
        name: "Anna",
        lastName: "Petrov",
        email: "anna@test.com",
        password: "Test1234!",
        phone: "053-5556677",
        age: 23,
        birthDate: "2002-11-02",
        gender: "Female",
        job: "Graphic Designer",
        aboutMe: "Visual thinker who speaks in colors and shapes. Fresh out of design school and ready to make noise.",
        profilePicture: "https://images.pexels.com/photos/1310522/pexels-photo-1310522.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/1568607/pexels-photo-1568607.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Germany", city: "Berlin", street: "Unter den Linden", house: 9, zip: 40001 },
        createdAt: "2026-02-15T10:00:00.000Z",
        lastLoginAt: "2026-02-16T10:00:00.000Z"  // older - inactive
    },
    {
        name: "Yoav",
        lastName: "Stern",
        email: "yoav@test.com",
        password: "Test1234!",
        phone: "050-8889900",
        age: 33,
        birthDate: "1992-08-14",
        gender: "Male",
        job: "Architect",
        aboutMe: "Designing spaces where people actually want to be. Architecture is frozen music.",
        profilePicture: "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverImage: "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800",
        address: { country: "Israel", city: "Herzliya", street: "Sokolov", house: 21, zip: 46100 },
        createdAt: "2026-02-20T10:00:00.000Z",
        lastLoginAt: "2026-02-22T10:00:00.000Z"  // older - inactive
    },
];

const mockCards = [
    {
        title: "My Brand Identity Process",
        content: "Every brand project starts with a discovery phase. I ask my clients three questions: Who are you? Who is your customer? What do you want them to feel? The answers shape everything — colors, typography, tone. Too many designers skip this and jump straight into Figma. Don't.",
        category: "UI/UX Design",
        mediaUrl: "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Haifa",
    },
    {
        title: "Minimalism in Design",
        content: "Removed half the elements from a client's landing page last week. Conversion went up 34%. Less really is more. Every element you add is a decision the user has to make. Make fewer decisions for them.",
        category: "UI/UX Design",
        mediaUrl: "https://images.pexels.com/photos/326503/pexels-photo-326503.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Haifa",
    },
    {
        title: "Why I Switched to Figma",
        content: "Used Sketch for years and thought I'd never leave. Then Figma came along with real-time collaboration and I've never looked back. The auto-layout system alone saved me hours every week. If you're still on Sketch or XD, give it a week.",
        category: "UI/UX Design",
        mediaUrl: "https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg?auto=compress&cs=tinysrgb&w=800",
        web: "https://www.figma.com",
        location: "New York",
    },
    {
        title: "NYC Coffee Shop Tour",
        content: "Spent my Saturday visiting 5 different coffee shops in Brooklyn. Not just for the coffee — I observe how people use space, where they sit, how long they stay. Every space is a UX problem someone tried to solve. Some nailed it. Some really didn't.",
        category: "Lifestyle",
        mediaUrl: "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "New York",
    },
    {
        title: "Design Systems Are Everything",
        content: "Built my first proper design system last month for a SaaS product. 47 components, 6 color tokens, 3 type scales. The first week felt like overhead. By week three the whole team was moving twice as fast. Consistency is a superpower.",
        category: "UI/UX Design",
        mediaUrl: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "New York",
    },
    {
        title: "How I Grew an Instagram from 0 to 10K",
        content: "No paid ads. No shortcuts. Just consistent posting, genuine engagement, and understanding what my audience actually wanted to see. The algorithm isn't your enemy — it rewards exactly what your audience rewards. Start there.",
        category: "Lifestyle",
        mediaUrl: "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Jerusalem",
    },
    {
        title: "The Jerusalem Food Scene",
        content: "People sleep on Jerusalem's food scene. Yes, hummus. But also incredible Ethiopian food in Mahane Yehuda, the best shakshuka I've ever had, and a new wave of modern Israeli cuisine that's quietly world class. Come hungry.",
        category: "Food & Recipes",
        mediaUrl: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Jerusalem",
    },
    {
        title: "Why I Love Distributed Systems",
        content: "There's something beautiful about a system that keeps working even when parts of it fail. CAP theorem, eventual consistency, consensus algorithms — this stuff genuinely excites me. Built a small Raft implementation last weekend just for fun.",
        category: "Technology",
        mediaUrl: "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "London",
    },
    {
        title: "My Home Studio Setup",
        content: "Finally built the desk setup I always dreamed about. Standing desk, ultrawide monitor, mechanical keyboard, and a proper mic for calls. The difference in focus and comfort is massive. Your environment shapes your output more than you think.",
        category: "Home Decor",
        mediaUrl: "https://images.pexels.com/photos/1029757/pexels-photo-1029757.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "London",
    },
    {
        title: "Getting Into Machine Learning",
        content: "Started Andrew Ng's course on neural networks six weeks ago. My brain hurt for the first two weeks. Week three something clicked. Now I'm building a simple image classifier and genuinely enjoying it. The math is not as scary as it looks.",
        category: "Science & Tech",
        mediaUrl: "https://images.pexels.com/photos/2599244/pexels-photo-2599244.jpeg?auto=compress&cs=tinysrgb&w=800",
        web: "https://www.coursera.org/learn/machine-learning",
        location: "London",
    },
    {
        title: "Shooting Golden Hour in Tel Aviv",
        content: "That 45 minute window after sunset is pure magic in this city. The light bounces off the Bauhaus buildings in a way that makes everything look like a painting. Grabbed my 50mm and just walked. These are some of my favorite shots ever.",
        category: "Photography",
        mediaUrl: "https://images.pexels.com/photos/1166209/pexels-photo-1166209.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Tel Aviv",
    },
    {
        title: "Film vs Digital — My Take",
        content: "Shot two rolls of Portra 400 last month alongside my Sony A7. The film shots have something the digital ones don't. I can't fully explain it — grain, color rendering, the fact that you only get 36 frames so every one counts. Not abandoning digital but film is staying in my bag.",
        category: "Photography",
        mediaUrl: "https://images.pexels.com/photos/3379943/pexels-photo-3379943.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Tel Aviv",
    },
    {
        title: "Books That Changed My Thinking",
        content: "Three books that rewired how I approach problems: Thinking Fast and Slow (Kahneman), The Psychology of Money (Housel), and Poor Charlie's Almanack. All three deal with decision-making under uncertainty. Read them in that order.",
        category: "Books & Literature",
        mediaUrl: "https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Toronto",
    },
    {
        title: "Playing Guitar After 10 Years",
        content: "Picked up my guitar again after a decade of telling myself I'd get back to it. The muscle memory is gone but something else remained — taste. I know what good sounds like. Now I just have to rebuild the technique to match it. Starting with 20 minutes a day.",
        category: "Music",
        mediaUrl: "https://images.pexels.com/photos/1407322/pexels-photo-1407322.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Toronto",
    },
    {
        title: "Winning My First CTF",
        content: "Competed in PicoCTF last month and placed in the top 15% globally. The reverse engineering challenges were brutal but I learned more in those 48 hours than in months of regular study. If you're into security, CTFs are the most effective way to level up.",
        category: "Technology",
        mediaUrl: "https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Beer Sheva",
    },
    {
        title: "Nature Walk After Work",
        content: "Twenty minutes in the forest does more than an hour of Netflix. Started walking in the park near my apartment every evening after work. No phone, no podcasts. Just walking. Sleep improved. Stress dropped. Obvious in hindsight.",
        category: "Nature & Outdoors",
        mediaUrl: "https://images.pexels.com/photos/167698/pexels-photo-167698.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Beer Sheva",
    },
    {
        title: "Exploring Barcelona's Architecture",
        content: "Gaudi's architecture is something you have to see in person. Photos don't capture the scale of Sagrada Familia or the way the light moves through Casa Batlló. I've lived here my whole life and I still stop and stare sometimes. Never take your city for granted.",
        category: "Travel & Places",
        mediaUrl: "https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Barcelona",
    },
    {
        title: "Teaching Kids to Code",
        content: "Introduced Scratch to my 4th grade class this semester. Within two weeks kids who struggle with traditional subjects were building animated stories and simple games. Coding isn't just a career skill — it's a new kind of literacy. Every kid should have access to it.",
        category: "Education",
        mediaUrl: "https://images.pexels.com/photos/256417/pexels-photo-256417.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Barcelona",
    },
    {
        title: "What Data Science Actually Looks Like",
        content: "Everyone thinks data science is fancy ML models. Reality: 80% of the job is cleaning messy data, writing SQL, and making charts that executives will actually understand. The modeling is the fun 20%. Learn to love the boring 80%.",
        category: "Science & Tech",
        mediaUrl: "https://images.pexels.com/photos/669615/pexels-photo-669615.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Ramat Gan",
    },
    {
        title: "My Morning Run Routine",
        content: "Started waking up at 6am for runs six months ago. First two weeks were miserable. Month two it became automatic. Now I feel off if I skip it. The compound effect is real — 5km every morning is 1,825km a year. Your future self will thank you.",
        category: "Fitness & Health",
        mediaUrl: "https://images.pexels.com/photos/2803158/pexels-photo-2803158.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Ramat Gan",
    },
    {
        title: "Street Art in Berlin",
        content: "Every wall in this city tells a different story. Berlin's street art scene isn't random vandalism — it's a visual archive of the city's history, politics, and identity. Spent a whole Sunday photographing the East Side Gallery. Never felt more inspired.",
        category: "Art & Design",
        mediaUrl: "https://images.pexels.com/photos/1647121/pexels-photo-1647121.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Berlin",
    },
    {
        title: "My Design School Portfolio",
        content: "Just wrapped up my final portfolio after four years of design school. 12 projects, 3 rebrand case studies, and one complete brand identity system I'm actually proud of. Scary and exciting to put it out into the world. Starting job applications next week.",
        category: "Graphic Design",
        mediaUrl: "https://images.pexels.com/photos/1568607/pexels-photo-1568607.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Berlin",
    },
    {
        title: "Architecture That Breathes",
        content: "The best buildings aren't just beautiful — they work with their environment. Natural ventilation, passive solar heating, materials that age gracefully. I'm obsessed with architects like Glenn Murcutt who design buildings that respond to where they are rather than fighting it.",
        category: "Art & Design",
        mediaUrl: "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Herzliya",
    },
    {
        title: "My Sourdough Journey",
        content: "After three failed attempts I finally got the perfect crust. The key was temperature consistency during the bulk fermentation and not being afraid of a high-hydration dough. Bread baking and architecture have the same principle — respect the materials.",
        category: "Food & Recipes",
        mediaUrl: "https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Herzliya",
    },
    {
        title: "Learning React Hooks",
        content: "React hooks completely changed how I think about component state. useEffect, useCallback, useMemo — once you really understand the dependency array everything else falls into place. Build something real with them, don't just read the docs.",
        category: "Technology",
        mediaUrl: "https://images.pexels.com/photos/11035471/pexels-photo-11035471.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Tel Aviv",
    },
    {
        title: "Full Stack is the Future",
        content: "There's a version of this debate where frontend devs and backend devs argue forever. And then there's the version where one person builds the whole thing and ships it in a weekend. Learn the full stack. Context switching is a superpower.",
        category: "Technology",
        web: 'https://www.jetbrains.com/idea/',
        mediaUrl: "https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=800",
        location: "Tel Aviv",
    },
]; 

const createSeedData = async () => {
    // 1. Connect to DB
    await connectToDB();

    try{
        // 2. Clear old data
        await User.deleteMany({})
        // this deletes all users from the collection. Run it once before the map, and you're guranteed no duplicates.

        // 3. Create users (map + Promise.all)
        const saveUser = mockUsers.map(async(mUser) => {
            mUser.password = await generateUserPassword(mUser.password)
            const normalizedUser = normalizeUser(mUser);
            let newUser = new User(normalizedUser);
            newUser = await newUser.save();
            return newUser;
        })
        // 4. Log success
        const savedUsers = await Promise.all(saveUser)
        // this wait for every user in the array to finish saving, then gives you the actual results. and you'll need savedUser later - why? because when you create cards, each card needs a user_id that points to a real saved user. where do you get those IDs? from the saved users that MongoDB gave _id values to.   

        console.log(`${savedUsers.length} users saved successfully`);

        await Card.deleteMany({});
        const saveCard = mockCards.map(async(mCard, index) => {
            mCard.userId = savedUsers[index % savedUsers.length]._id;
            mCard.likes = savedUsers.slice(0, (index % savedUsers.length) + 1)
            .map(u => u._id.toString())
            // savedUsers.slice(0, 3)     → [davidObj, sarahObj, mikeObj]
            // .map(u => u._id.toString()) → ["abc123", "def456", "ghi789"]

            mCard.comments = savedUsers.slice(0, (index % savedUsers.length) + 1)
            .map(u => ({userId: u._id, commentText: 'I actually enjoyed reading this more than I expected'}))
            const normalizedCard = normalizeCard(mCard);
            let newCard = new Card(normalizedCard);
            newCard = await newCard.save();
            return newCard;
        })

        const savedCards = await Promise.all(saveCard);
        console.log(`${savedCards.length} cards saved successfully`);
    }
    catch(err){
        console.log(err.message);
    }
    finally{
        // 5. Disconnect
        await disconnectDB();
    }
}

createSeedData();
