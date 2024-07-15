// import React from 'react'
// import { render } from 'react-dom'
// import { HashRouter, Route, Switch } from 'react-router-dom'
// import { Main } from 'Pages/Main'
// import { AnotherPage } from 'Pages/AnotherPage'
//
// const Layout = () => {
//     return (
//         <HashRouter>
//             <Switch>
//                 <Route path="/" exact component={Main} />
//                 <Route path="/another" exact component={AnotherPage} />
//             </Switch>
//         </HashRouter>
//     )
// }
// render(<Layout />, document.getElementById('root'))

import React from 'react'
import { render } from 'react-dom'
import { HashRouter, Route, Switch } from 'react-router-dom'
import { Main } from 'Pages/Main'
import { CourseDetails } from 'Pages/CourseDetails'
import { UserProvider } from 'Pages/UserContext';
import { Auth } from 'Pages/Auth';
import { UserProfile } from 'Pages/UserProfile';
import { ChangePassword } from 'Pages/ChangePassword'
import { AddCourse } from 'Pages/AddCourse';
import GenerateImage from 'Pages/GenerateImage'
import NotificationsPage from 'Pages/NotificationsPage';
import AdminDashboard from 'Pages/AdminDashboard';
import Modal from 'react-modal';

Modal.setAppElement('#root');
const Layout = () => {
    return (
        <UserProvider>
        <HashRouter>
            <Switch>
                <Route path="/" exact component={Main} />
                <Route path="/course/:id" exact component={CourseDetails} />
                <Route path="/auth" exact component={Auth} />
                <Route path="/user/:username" component={UserProfile} />
                <Route path="/change-password" component={ChangePassword} />
                <Route path="/add-course" component={AddCourse} />
                <Route path="/generate-image" component={GenerateImage} />
                <Route path="/notifications" component={NotificationsPage} />
                <Route path="/admin-dashboard" component={AdminDashboard} />
            </Switch>
        </HashRouter>
        </UserProvider>
    )
}
render(<Layout />, document.getElementById('root'))