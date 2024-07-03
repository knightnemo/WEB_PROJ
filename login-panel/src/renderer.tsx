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
import { AnotherPage } from 'Pages/AnotherPage'
import { CourseDetails } from 'Pages/CourseDetails'

const Layout = () => {
    return (
        <HashRouter>
            <Switch>
                <Route path="/" exact component={Main} />
                <Route path="/another" exact component={AnotherPage} />
                <Route path="/course/:id" exact component={CourseDetails} />
            </Switch>
        </HashRouter>
    )
}
render(<Layout />, document.getElementById('root'))