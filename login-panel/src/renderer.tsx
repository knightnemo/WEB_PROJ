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
import  Auth  from 'Pages/Auth';
import ChangePassword from 'Pages/ChangePassword'

const Layout = () => {
    return (
        <HashRouter>
            <Switch>
                <Route path="/" exact component={Main} />
                <Route path="/course/:id" exact component={CourseDetails} />
                <Route path="/auth" exact component={Auth} />
                <Route path="/change-password" exact component={ChangePassword} />
            </Switch>
        </HashRouter>
    )
}
render(<Layout />, document.getElementById('root'))