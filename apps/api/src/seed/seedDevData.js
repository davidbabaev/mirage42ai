// One-off dev seed for mirage42ai.
//
// Run from apps/api/ with: `node src/seed/seedDevData.js`
//
// Idempotent and scoped: wipes ONLY the users in `seedUsers` (by email) and
// their cards before re-inserting. Any other users / cards already in the DB
// (e.g. accounts you registered manually) are untouched, so it's safe to run
// against a dev DB that already has data.
//
// Connects to whatever DB_CONNECTION_STRING is in apps/api/.env.

require('dotenv').config();

const User = require('../users/models/User');
const Card = require('../cards/models/Card');
const normalizeUser = require('../users/helpers/normalizeUser');
const normalizeCard = require('../cards/helpers/normalizeCard');
const { generateUserPassword } = require('../users/helpers/bcrypt');
const { connectToDB, disconnectDB } = require('../dbService');

const SEED_PASSWORD = 'Test1234!';

// 8 users — first one is admin. Same shape as the original seedScript.js so
// schema validation passes.
const seedUsers = [
    {
        name: 'David', lastName: 'Cohen', email: 'david@test.com',
        phone: '050-1234567', age: 28, birthDate: '1997-05-12', gender: 'Male',
        job: 'Software Engineer',
        aboutMe: 'Full-stack developer who loves building apps.',
        profilePicture: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400',
        coverImage: 'https://images.pexels.com/photos/4974915/pexels-photo-4974915.jpeg?auto=compress&cs=tinysrgb&w=800',
        address: { country: 'Israel', city: 'Tel Aviv', street: 'Rothschild', house: 42, zip: 12345 },
        isAdmin: true,
    },
    {
        name: 'Sarah', lastName: 'Levi', email: 'sarah@test.com',
        phone: '052-9876543', age: 25, birthDate: '2000-08-23', gender: 'Female',
        job: 'Graphic Designer',
        aboutMe: 'Visual thinker who speaks in colors and shapes.',
        profilePicture: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=400',
        coverImage: 'https://images.pexels.com/photos/1939485/pexels-photo-1939485.jpeg?auto=compress&cs=tinysrgb&w=800',
        address: { country: 'Israel', city: 'Haifa', street: 'Herzl', house: 12, zip: 31000 },
    },
    {
        name: 'Mike', lastName: 'Ross', email: 'mike@test.com',
        phone: '054-5551234', age: 32, birthDate: '1993-11-07', gender: 'Male',
        job: 'UI/UX Designer',
        aboutMe: 'Building digital products that feel human.',
        profilePicture: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400',
        coverImage: 'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=800',
        address: { country: 'United States', city: 'New York', street: 'Broadway', house: 100, zip: 10001 },
    },
    {
        name: 'Noa', lastName: 'Mizrahi', email: 'noa@test.com',
        phone: '053-1112233', age: 27, birthDate: '1998-03-15', gender: 'Female',
        job: 'Marketing Specialist',
        aboutMe: 'Marketing specialist obsessed with brand storytelling.',
        profilePicture: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400',
        coverImage: 'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=800',
        address: { country: 'Israel', city: 'Jerusalem', street: 'Jaffa', house: 18, zip: 91000 },
    },
    {
        name: 'Ethan', lastName: 'Brown', email: 'ethan@test.com',
        phone: '057-4445566', age: 30, birthDate: '1995-07-22', gender: 'Male',
        job: 'Backend Engineer',
        aboutMe: 'Backend engineer who enjoys distributed systems.',
        profilePicture: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=400',
        coverImage: 'https://images.pexels.com/photos/574071/pexels-photo-574071.jpeg?auto=compress&cs=tinysrgb&w=800',
        address: { country: 'United Kingdom', city: 'London', street: 'Baker', house: 22, zip: 10002 },
    },
    {
        name: 'Maya', lastName: 'Shapiro', email: 'maya@test.com',
        phone: '058-7778899', age: 24, birthDate: '2001-01-10', gender: 'Female',
        job: 'Photographer',
        aboutMe: 'Capturing moments one frame at a time.',
        profilePicture: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400',
        coverImage: 'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=800',
        address: { country: 'Israel', city: 'Tel Aviv', street: 'Dizengoff', house: 55, zip: 64332 },
    },
    {
        name: 'James', lastName: 'Walker', email: 'james@test.com',
        phone: '050-3334455', age: 35, birthDate: '1990-09-30', gender: 'Male',
        job: 'Finance Analyst',
        aboutMe: 'Finance analyst by day, guitarist by night.',
        profilePicture: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400',
        coverImage: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
        address: { country: 'Canada', city: 'Toronto', street: 'King', house: 77, zip: 30301 },
    },
    {
        name: 'Lior', lastName: 'Ben David', email: 'lior@test.com',
        phone: '052-6667788', age: 29, birthDate: '1996-12-05', gender: 'Male',
        job: 'Cybersecurity Engineer',
        aboutMe: 'Making the internet a safer place one bug at a time.',
        profilePicture: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=400',
        coverImage: 'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=800',
        address: { country: 'Israel', city: 'Beer Sheva', street: 'Rager', house: 10, zip: 84100 },
    },
];

// Card content. Each card is assigned to seedUsers[index % 8] when inserted.
// IMAGE cards use Pexels (public, no Cloudinary). VIDEO cards use Google's
// public sample bucket (CORS-friendly, well-known test assets) — these are
// what you'll use to verify the "background video pauses when modal opens" fix.
const seedCards = [
    { title: 'My Brand Identity Process', content: 'Every brand project starts with a discovery phase. Who are you? Who is your customer? What do you want them to feel? Too many designers skip this and jump straight into Figma.', category: 'UI/UX Design', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Haifa' },
    { title: 'Minimalism in Design', content: 'Removed half the elements from a client page last week. Conversion went up 34%. Less really is more.', category: 'UI/UX Design', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/326503/pexels-photo-326503.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Haifa' },
    { title: 'Why I Switched to Figma', content: 'Used Sketch for years and thought I would never leave. Then Figma came along with real-time collaboration and I have not looked back.', category: 'UI/UX Design', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg?auto=compress&cs=tinysrgb&w=800', web: 'https://www.figma.com', location: 'New York' },
    { title: 'NYC Coffee Shop Tour', content: 'Spent my Saturday visiting 5 coffee shops in Brooklyn. Not just for the coffee — I observe how people use space.', category: 'Lifestyle', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'New York' },
    { title: 'Design Systems Are Everything', content: 'Built my first proper design system last month for a SaaS product. By week three the whole team was moving twice as fast.', category: 'UI/UX Design', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'New York' },
    { title: 'How I Grew an Instagram from 0 to 10K', content: 'No paid ads. Just consistent posting, genuine engagement, and understanding what my audience actually wanted to see.', category: 'Lifestyle', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Jerusalem' },
    { title: 'The Jerusalem Food Scene', content: 'People sleep on Jerusalem food. Hummus, yes, but also incredible Ethiopian in Mahane Yehuda and a new wave of modern Israeli cuisine.', category: 'Food & Recipes', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Jerusalem' },
    { title: 'Why I Love Distributed Systems', content: 'There is something beautiful about a system that keeps working when parts of it fail. Built a small Raft implementation last weekend just for fun.', category: 'Technology', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'London' },
    { title: 'My Home Studio Setup', content: 'Standing desk, ultrawide monitor, mechanical keyboard, and a proper mic for calls. Environment shapes output more than you think.', category: 'Home Decor', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/1029757/pexels-photo-1029757.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'London' },
    { title: 'Shooting Golden Hour in Tel Aviv', content: 'That 45-minute window after sunset is pure magic in this city. The light bounces off the Bauhaus buildings.', category: 'Photography', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/1166209/pexels-photo-1166209.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Tel Aviv' },
    { title: 'Film vs Digital — My Take', content: 'Shot two rolls of Portra 400 last month alongside my Sony A7. The film shots have something the digital ones do not.', category: 'Photography', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/3379943/pexels-photo-3379943.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Tel Aviv' },
    { title: 'Books That Changed My Thinking', content: 'Three books that rewired how I approach problems: Thinking Fast and Slow, The Psychology of Money, Poor Charlie\'s Almanack.', category: 'Books & Literature', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Toronto' },
    { title: 'Playing Guitar After 10 Years', content: 'Picked up my guitar again after a decade. The muscle memory is gone but taste remains. Starting with 20 minutes a day.', category: 'Music', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/1407322/pexels-photo-1407322.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Toronto' },
    { title: 'Winning My First CTF', content: 'Competed in PicoCTF and placed in the top 15% globally. CTFs are the most effective way to level up in security.', category: 'Technology', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Beer Sheva' },
    { title: 'Learning React Hooks', content: 'Once you really understand the dependency array everything else falls into place. Build something real with them, do not just read the docs.', category: 'Technology', mediaType: 'image', mediaUrl: 'https://images.pexels.com/photos/11035471/pexels-photo-11035471.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Tel Aviv' },
    { title: 'Full Stack is the Future', content: 'There is a version of this debate where frontend devs and backend devs argue forever. And then there is the version where one person builds the whole thing and ships it in a weekend.', category: 'Technology', mediaType: 'image', web: 'https://www.jetbrains.com/idea/', mediaUrl: 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=800', location: 'Tel Aviv' },

    // --- VIDEO cards (Google's public sample bucket; use these to verify the
    // "background video pauses when modal opens" fix). The frontend renders
    // <video src=... controls /> so you'll need to click play in the feed,
    // then click the card to open the modal — the feed video should stop.
    { title: 'Animation Showcase — Big Buck Bunny', content: 'A short open-source animation. Play this in the feed, then click the card to open it. The feed video should pause when the modal opens.', category: 'Art & Design', mediaType: 'video', mediaUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4', location: 'Tel Aviv' },
    { title: 'Sintel Trailer', content: 'A second video card for verifying behavior with multiple videos on the same feed. Start one playing, then start the other, then click into a modal.', category: 'Art & Design', mediaType: 'video', mediaUrl: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4', location: 'London' },
];

// Follow graph (by email). Keeps the feed interesting for every signed-in user.
const followsByEmail = {
    'david@test.com':  ['sarah@test.com', 'mike@test.com', 'noa@test.com', 'maya@test.com'],
    'sarah@test.com':  ['david@test.com', 'mike@test.com', 'maya@test.com'],
    'mike@test.com':   ['david@test.com', 'ethan@test.com', 'noa@test.com', 'lior@test.com'],
    'noa@test.com':    ['david@test.com', 'sarah@test.com', 'maya@test.com', 'james@test.com'],
    'ethan@test.com':  ['mike@test.com', 'lior@test.com', 'david@test.com'],
    'maya@test.com':   ['sarah@test.com', 'noa@test.com', 'david@test.com'],
    'james@test.com':  ['david@test.com', 'mike@test.com', 'ethan@test.com'],
    'lior@test.com':   ['david@test.com', 'mike@test.com', 'ethan@test.com'],
};

async function seed() {
    await connectToDB();
    try {
        const emails = seedUsers.map(u => u.email);

        // 1. Scoped cleanup — find seed users, delete their cards, delete them.
        const existing = await User.find({ email: { $in: emails } }, '_id');
        const existingIds = existing.map(u => u._id);
        const removedCards = await Card.deleteMany({ userId: { $in: existingIds } });
        const removedUsers = await User.deleteMany({ email: { $in: emails } });
        console.log(`Cleaned up ${removedUsers.deletedCount} seed users and ${removedCards.deletedCount} of their cards.`);

        // 2. Insert fresh users.
        const hashed = await generateUserPassword(SEED_PASSWORD);
        const savedUsers = await Promise.all(
            seedUsers.map(async (u) => {
                const data = normalizeUser({ ...u, password: hashed });
                return new User(data).save();
            })
        );
        const byEmail = Object.fromEntries(savedUsers.map(u => [u.email, u]));
        console.log(`Inserted ${savedUsers.length} users.`);

        // 3. Wire follow relationships (stored as string IDs per the schema).
        for (const [email, targets] of Object.entries(followsByEmail)) {
            const user = byEmail[email];
            if (!user) continue;
            user.following = targets
                .map(t => byEmail[t]?._id?.toString())
                .filter(Boolean);
            await user.save();
        }
        const totalFollows = Object.values(followsByEmail).reduce((n, arr) => n + arr.length, 0);
        console.log(`Wired ${totalFollows} follow relationships.`);

        // 4. Insert cards. Distribute across users, sprinkle likes + comments.
        const COMMENT_TEXTS = [
            'Loved this — thanks for sharing!',
            'This actually changed how I think about it.',
            'Saving this to come back to later.',
            'Great post, would read more like it.',
        ];
        const savedCards = await Promise.all(
            seedCards.map(async (template, index) => {
                const author = savedUsers[index % savedUsers.length];
                const likers = savedUsers
                    .filter(u => u._id.toString() !== author._id.toString())
                    .slice(0, (index % 5) + 1);
                const commenters = savedUsers
                    .filter(u => u._id.toString() !== author._id.toString())
                    .slice(0, (index % 3) + 1);
                const card = {
                    ...template,
                    userId: author._id,
                    likes: likers.map(u => u._id.toString()),
                    comments: commenters.map((u, i) => ({
                        userId: u._id,
                        commentText: COMMENT_TEXTS[(index + i) % COMMENT_TEXTS.length],
                    })),
                };
                return new Card(normalizeCard(card)).save();
            })
        );
        const videoCount = seedCards.filter(c => c.mediaType === 'video').length;
        console.log(`Inserted ${savedCards.length} cards (${videoCount} videos, ${savedCards.length - videoCount} images).`);
    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exitCode = 1;
    } finally {
        await disconnectDB();
    }
}

seed();
