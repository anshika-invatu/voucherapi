'use strict';


//BASE-271

module.exports = async (context) => {
   
    context.res = {
        body: {
            code: 200,
            text: 'ping'
        }
    };
    
};
