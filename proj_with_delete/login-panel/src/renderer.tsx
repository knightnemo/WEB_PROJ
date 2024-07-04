import React from 'react'
import { render } from 'react-dom'
import { HashRouter, Route, Switch } from 'react-router-dom'
import { Main } from 'Pages/Main'
import { AnotherPage } from 'Pages/AnotherPage'

const Layout = () => {
    return (
        <HashRouter>
            <Switch>
                <Route path="/" exact component={Main} />
                <Route path="/AnotherPage" exact component={AnotherPage} /> ///请注意是在这里搞Route的路径
            </Switch>
        </HashRouter>
    )
}
render(<Layout />, document.getElementById('root'))
