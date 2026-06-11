import { useCardsProvider } from '../../../providers/CardsProvider';
import useCountries from '../../../hooks/useCountries';
import { useUsersProvider } from '../../../providers/UsersProvider';

function useAnalytics() {

  const {apiCountriesList} = useCountries(); 
  const {registeredCards} = useCardsProvider();
  const {users} = useUsersProvider();

  const registeredCardsLength = registeredCards.length;
  const usersLength = users.length;


// =========================================================   
// Totals Simple Analytics:

  const commentsCount = registeredCards.reduce((sum, card) => sum + (card.comments || []).length, 0);

  const likesCount = registeredCards.reduce((sum, card) => sum + (card.likes || []).length, 0);
  

// =========================================================
// - Posts Avg. Engagement

const avgEngagement = ((commentsCount + likesCount) / registeredCards.length).toFixed(1);

// =========================================================
// Active user/ users calculations (users with most cards) - Logics:   
// - Most Active User
// - Top 10 Active Users

  const usersC = users.map((user) => {
    const maxCardsUser = registeredCards.filter((card) => {
      const usersCards = card.userId === user._id
      return usersCards;
    })
    return {name: user.name + ' ' + user.lastName, posts: (maxCardsUser || []).length}
  }) 

  const topTenUsers = [...usersC].sort((a,b) => b.posts - a.posts).slice(0,10)
  
  const mostActiveUser = usersC.length > 0
  ? usersC.reduce((max, current) => current.posts > max.posts ? current : max)
  : null;
  
  
// =========================================================
// Cards with most likes - Logics:
// - Most Liked Card
// - Top 10 Liked Cards

  const topTenlikedCards = [...registeredCards].sort((a,b) => b.likes.length- a.likes.length).slice(0, 10)

  const mostLikesCard = registeredCards.length > 0
  ? registeredCards.reduce((max, current) => current.likes.length > max.likes.length ? current : max)
  : null;
  

// =========================================================
  
  const lastFiveUsers = [...users].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5)

  const lastFiveCards = [...registeredCards].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5)


// =========================================================
// Categories calculations - Logics:
// - Posts by categories (list) "Technology - 4 Posts":
// - 10 Most popular categories (Pie Chart)

  const countPerCategory = registeredCards.reduce((acc, card) => {
    if(acc[card.category]){
      acc[card.category] = acc[card.category] + 1
    } else{
      acc[card.category] = 1
    }
    return acc
  }, {})

  
  const arrayCountPerCategory = Object.entries(countPerCategory).map((item) => {
    return {name: item[0], posts: item[1]}
  });

  const topTenCategories = [...arrayCountPerCategory].sort((a,b) => b.posts - a.posts).slice(0,10)
  

// =========================================================
// Users Registrations - Logics
// - Users registration (Line Chart)
// - 

  const groupUsersRegistarationByMonth = users.reduce((acc, user) => {
    const userCreatedDate = user.createdAt.slice(0,7);
    if(acc[userCreatedDate]){
          acc[userCreatedDate] = acc[userCreatedDate] + 1
      }
      else{
        acc[userCreatedDate] = 1
      }
      return acc
  }, {})

  const arrayGroupUsersRegistarationByMonth = Object.entries(groupUsersRegistarationByMonth).map((item) => {
    return{month: item[0], users: item[1]}
  }).sort((a,b) => new Date(a.month) - new Date(b.month))



// =========================================================
// - Gender percents Male 50% / female 50% (Pie Chart)
// - gender & ages - percents of male/ female per renges of ages (Bar Chart)

  const ageRange = (age) => {
    if(age >= 13 && age <= 17) return "13-17"
    if(age >= 18 && age <= 24) return "18-24"
    if(age >= 25 && age <= 34) return "25-34"
    if(age >= 35 && age <= 44) return "35-44"
    if(age >= 45 && age <= 54) return "45-54"
    if(age >= 55 && age <= 64) return "55-64"
    if(age > 64) return "65+"
  }

  const countPerGender = users.reduce((acc, user) => {
    if(acc[user.gender]){
      acc[user.gender] = acc[user.gender] + 1
    }
    else{
      acc[user.gender] = 1
    }
    return acc;
  }, {})

  const arrayGroup_countPerGender = Object.entries(countPerGender).map((item) => {
    return {gender: item[0], count: item[1]}
  })

  const genderByAge = users.reduce((acc, user) => {
    const range = ageRange(user.age); // "25-34"

    if(!acc[range]){
      acc[range] = {Male: 0, Female: 0}
    }
    acc[range][user.gender] = acc[range][user.gender] + 1
    return acc;
  }, {}) 

  const group_genderByAge = Object.entries(genderByAge).map((item) => {
    return { ages: item[0], ...item[1]}
  }).sort((a,b) => a.ages[0] - b.ages[0])



// =========================================================
// - count user per country (USA: 8,000 users)
// - percent progress bar how many percents take each country of the whole app users
//  (60% of the users in our app is from USA)

  const filteredUsers = users.filter((user) => {
    return user.address.country !== "" && user.address.country !== "Not Defined"
  })

  const countCountriesPerUsers = filteredUsers.reduce((acc, user) => {
    if(acc[user.address.country]){
      acc[user.address.country] = acc[user.address.country] + 1;
    }
    else{
      acc[user.address.country] = 1;
    }
    return acc;
  },{})

  const group_countCountriesPerUsers = 
  Object.entries(countCountriesPerUsers).map((item) => {
    const foundCountry = apiCountriesList.find(f => f.name === item[0])
    return {
      country: item[0], 
      count: item[1],
      percent: (item[1] / filteredUsers.length * 100).toFixed(0),
      flag: foundCountry?.flag || "https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png"
    }
  }).sort((a,b) => b.count - a.count)


// =========================================================
// - Top 5 cards with most likes + cards

  const topFiveCards = [...registeredCards]
  .sort((a,b) => {
      const aEng = a.likes.length + a.comments.length
      const bEng = b.likes.length + b.comments.length
      return bEng - aEng;
  }).slice(0,5)


// =========================================================   
// Daily Login - Logics: 
// - Logged In Today

  const date = new Date();

  const DailyActiveUsers = users.filter((user) => {
    const todayLoggedInDate = date.toISOString().split("T")[0] === user.lastLoginAt?.split("T")[0];

    return todayLoggedInDate;
  })

  const dailyActiveUsersCount = DailyActiveUsers.length;

// =========================================================   
// Login one day VS yesterday logics:
// - logged in testerday
// - % Than yesterday

  const oneDayInMs = 1 * 24 * 60 * 60 * 1000;
  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
  const dateInOneDay = date.getTime() - oneDayInMs;
  const dateInTwoDays = date.getTime() - twoDaysInMs;
  
  const loggedInYesterday = users.filter((user) => {
    const userDate = new Date(user.lastLoginAt).getTime();
    const Yesterday = userDate < dateInOneDay && userDate >= dateInTwoDays
    return Yesterday;
  }) 
  
  const loggedInYesterdayCount = loggedInYesterday.length;

  const loginGrowthRate = 
  loggedInYesterdayCount === 0 ? 0 :
  (dailyActiveUsersCount - loggedInYesterdayCount) / loggedInYesterdayCount * 100; 

// =========================================================   
// Logged-in (Activity) weekly - logics:

  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
  const dateInSevenDays = date.getTime() - sevenDaysInMs
  const dateInFourteenDays = date.getTime() - fourteenDaysInMs
  
  const WeeklyActiveUsers = users.filter((user) => {
    const userDate = new Date(user.lastLoginAt).getTime();
    const loggedIn = userDate >= dateInSevenDays
    return loggedIn
  })
  
  const weeklyActiveUsersCount = WeeklyActiveUsers.length;
  
  const moreThenSevenDays = users.filter((user) => {
    const userDate = new Date(user.lastLoginAt).getTime();
    const loggedIn = userDate >= dateInFourteenDays && userDate < dateInSevenDays

    return loggedIn
  })


// =========================================================   
// RegisteredUser Per Weeks - Logics:  

  const newRegisteredUsers_ThisWeek = users.filter((user) => {
    const userDate = new Date(user.createdAt);
    const created = userDate >= dateInSevenDays
    return created
  })

  const newRegisteredUsers_ThisWeek_count = newRegisteredUsers_ThisWeek.length;
  
  const newRegisteredUsers_LastWeek = users.filter((user) => {
    const userDate = new Date(user.createdAt);
    const created = userDate >= dateInFourteenDays && userDate < dateInSevenDays
    
    return created;
  })

  const newRegisteredUsers_LastWeek_count = newRegisteredUsers_LastWeek.length;
  
  const registeredGrowthRate = 
  newRegisteredUsers_LastWeek_count === 0 ? 0 : 
  (newRegisteredUsers_ThisWeek_count - newRegisteredUsers_LastWeek_count) / newRegisteredUsers_LastWeek_count * 100;

  const moreThenSevenDaysCount = moreThenSevenDays.length;


// =========================================================   
// Retention users -> Register + Loggings - Logics:

  const weekLoginGrowth = 
    moreThenSevenDaysCount === 0 ? 0 :
    (weeklyActiveUsersCount - moreThenSevenDaysCount) / moreThenSevenDaysCount * 100


  const retentionUsers = newRegisteredUsers_LastWeek.filter((user) => {
    return WeeklyActiveUsers.some(userS => userS._id === user._id)
  })

  const retentionUsersCount = retentionUsers.length;

  const retention = 
  newRegisteredUsers_LastWeek_count === 0 ? 0 :
  (retentionUsersCount / newRegisteredUsers_LastWeek_count) * 100
  

// =========================================================   
// thirty days (Month) Loggings analytics (Chart) - "users monthly activity":

  const thertyDaysInMs = 30 * 24 * 60 * 60 * 1000;
  const dateThertyDays = date.getTime() - thertyDaysInMs;
  
  const loggedInThirtyDays = users.filter((user) => {
    const userDate = new Date(user.lastLoginAt).getTime();

    const ThertyDays = userDate > dateThertyDays
    return ThertyDays;
  }) 

    const groupUsersLoginActivity = loggedInThirtyDays.reduce((acc, user) => {
    const userLoginDate = user.lastLoginAt.slice(0,10);
    if(acc[userLoginDate]){
          acc[userLoginDate] = acc[userLoginDate] + 1
      }
      else{
        acc[userLoginDate] = 1
      }
      return acc
  }, {})

  const arrayGroupUsersLoginActivity = 
  Object.entries(groupUsersLoginActivity).map((item) => {
    return{day: item[0], users: item[1]}
  }).sort((a,b) => new Date(a.day) - new Date(b.day))

  const loggedInThirtyDaysCount = loggedInThirtyDays.length;

// =========================================================

  return{
    commentsCount,
    likesCount,
    newRegisteredUsers_ThisWeek_count,
    newRegisteredUsers_LastWeek_count,
    weeklyActiveUsersCount,
    moreThenSevenDaysCount,
    loggedInThirtyDays,
    loggedInThirtyDaysCount,
    arrayCountPerCategory,
    topTenUsers,
    mostActiveUser,
    mostLikesCard,
    lastFiveUsers,
    lastFiveCards,
    topTenCategories,
    arrayGroupUsersRegistarationByMonth,
    arrayGroup_countPerGender,
    group_genderByAge,
    group_countCountriesPerUsers,
    avgEngagement,
    topFiveCards,
    topTenlikedCards,
    dailyActiveUsersCount,
    registeredGrowthRate,
    loggedInYesterdayCount,
    weekLoginGrowth,
    loginGrowthRate,
    retention,
    arrayGroupUsersLoginActivity,
    registeredCardsLength,
    usersLength
  }
}

export default useAnalytics;