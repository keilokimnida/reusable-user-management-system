import jwtDecode from "jwt-decode";
import axios from 'axios';
import APP_CONFIG from '../config/appConfig';

const tokenManager = () => {
    let accessToken = null;
    let message = "";

    const getToken = () => accessToken;

    const getDecodedToken = () => {
        if (accessToken) {
            return jwtDecode(accessToken);
        } else {
            return null;
        }

    };

    const setToken = (pToken) => {
        accessToken = pToken;
        return true;
    };

    const removeToken = () => {
        accessToken = null;
        return true;
    };

    const logout = async () => {
        console.log()
        try {
            await axios.post(`${APP_CONFIG.baseUrl}/auth/logout`, {}, {withCredentials: true});
            window.localStorage.setItem("logout", Date.now());
            accessToken = null;
            return true;
        } catch (error) {
            console.log(error);
            console.log(error.response)
            return false;
        };
    };

    const getMessage = () => message;

    const setMessage = (pMsg) => {
        message = pMsg;
        return true;
    };

    return {
        getToken,
        getDecodedToken,
        setToken,
        removeToken,
        logout,
        getMessage,
        setMessage
    };
};

export default tokenManager();