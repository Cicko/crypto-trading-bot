import React, { Component } from 'react';
import logo from '../logo.svg';
import '../App.css';
import axios from 'axios';
import Select from 'react-select';
import  {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend} from 'recharts';
import 'react-select/dist/react-select.css';

// BROWSER TO RUN CORS
// chromium-browser --disable-web-security --user-data-dir="[some directory here]"

const DEBUG_OPERATIONS = true;

const LENGTH = 24 * 12; // * 1 * 6 * 30;

const LIMIT = 1;

const PERCENTAGE_TO_BUY = 1;

const LIMIT_CURRENCIES = 10;

const CASH_BASE = 5;

const MONEY_PARTS = 20;

const COIN_TO_CHECK = 'BTC-DOGE';

let comissions_sum = 0;

class App extends Component {

  constructor() {
    super();
    this.state = {
      currencies: [],
      data: {},
      selectedOption: { label: '5 minutes', value: 'fiveMin'},
    };
  }
  handleChange = (selectedOption) => {
    this.setState({ selectedOption });
    if (selectedOption) {
      console.log(`Selected: ${selectedOption.value}`);
      let counter = 0;
      this.state.currencies.forEach(c => {
        this.setState({
          [c]: [],
        }, () => {
          counter++;
          if (counter === this.state.currencies.length) {
            this.fetchData();
          }
        });
      });
    }
  }

  componentDidMount = () => {
    axios.get('https://bittrex.com/api/v1.1/public/getmarketsummaries')
    .then((res) => {
      this.setState({
        currencies: res.data.result.map(c => c.MarketName),
      }, () => {
        this.fetchData();
      });
    });
  }

  fetchData = () => {
    let allFetchs = [];
    this.state.currencies.forEach(c => {
      allFetchs.push(new Promise((resolve, reject) => {
        axios.get(`https://bittrex.com/Api/v2.0/pub/market/GetTicks?marketName=${c}&tickInterval=${this.state.selectedOption.value}`)
        .then((res) => {
          if (res.data.result) {
            const cutResult = res.data.result.splice(-LENGTH);
            const cash = this.checkCash(c, cutResult);
            this.setState(({ currencies }) => ({
              [c]: cutResult.map(x => ({
                name: x.T,
                H: x.H,
                C: x.C,
                L: x.L,
              })),
              ['cash'.concat(c)]: cash,
            }), () => {
              resolve();
            });
          }
        }).catch(e => {
          reject(e);
        });
      }));
    });
    Promise.all(allFetchs).then(() => {
      this.setState(({currencies}) => ({
        currencies: this.sortByCash(currencies),
        loaded: true,
      }), () => {
        this.setState(({currencies}) => ({
          currencies: this.sortByCash(currencies),
        }));
      });
    });
  }

  sortByCash = (currencies) => currencies.sort((a, b) => this.getCash(a) > this.getCash(b) ? -1 : 1);

  getCash = (crypto) => {
    return this.state['cash'.concat(crypto)];
  }

  checkCash = (c, result) => {
    let money = CASH_BASE;
    let coins = 0;
    let toBuy = true;

    const STEPS = 1;
    let boughtFor = 0;
    let soldFor = 0;

    // one step
    const goUp = (x, i) => x[i-1].C < x[i].C;
    const goDown = (x, i) => x[i-1].L > x[i].H;

    // two steps
    // const goUp = (x, i) => x[i-2].C < x[i-1].C && x[i-1].C < x[i].C;
    // const goDown = (x, i) => x[i-2].C > x[i-1].C && x[i-1].C > x[i].C;

    // three steps
    // const goUp = (x, i) => x[i-3].C < x[i-2].C && x[i-2].C < x[i-1].C && x[i-1].C < x[i].C;
    // const goDown = (x, i) => x[i-3].C > x[i-2].C && x[i-2].C > x[i-1].C && x[i-1].C > x[i].C;

    const commision = 0.9975
    // console.log('----COIN [', c, ']');


    result.forEach((x, i, arr) => {
      if (DEBUG_OPERATIONS && c === COIN_TO_CHECK) {
        console.log(x.T);
      }
      /*
      console.log(money);
      console.log(coins);
      */
      if (i >= STEPS) {
        if (boughtFor === 0 && toBuy || x.H < soldFor && toBuy) {
          boughtFor = x.H;
          coins = (money / x.H) * commision;
          if (DEBUG_OPERATIONS && c === COIN_TO_CHECK) {
            console.log('BUY FOR ', x.H);
            console.log('COINS: ', coins);
            comissions_sum++
          }
          money = 0;
          toBuy = false;
        }
        if (x.L > boughtFor * PERCENTAGE_TO_BUY && !toBuy) {  //
          soldFor = x.L;

          money = coins * x.L * commision;
          if (DEBUG_OPERATIONS && c === COIN_TO_CHECK) {
            console.log('SELL FOR ', x.L);
            console.log('MONEY: ', coins * x.L);
          }
          comissions_sum++;
          coins = 0;
          toBuy = true;
        }
      }
    });
    /*
    console.log(c);
    console.log('money');
    console.log(money);
    console.log('coins');
    console.log(coins);
    */
    if (money !== 0) {
      return money;
    } else {
      return Number(coins * result[result.length - 1].C);
    }
  }

  drawChart = (c) =>
    <LineChart stackOffset={'expand'} width={1500} height={300} data={this.state[c]}
        margin={{top: 5, right: 30, left: 20, bottom: 5}}>
      <XAxis dataKey="name"/>
      <YAxis domain={['dataMin', 'dataMax']}/>
      <CartesianGrid strokeDasharray="3 3"/>
      <Tooltip/>
      <Legend />
      <Line type="monotone" dataKey="H" stroke="#ff0000" activeDot={{r: 8}}/>
      <Line type="monotone" dataKey="L" stroke="#0000FF" activeDot={{r: 8}}/>
    </LineChart>;

  render() {
    const { selectedOption } = this.state;
    let profit = 0;
    let counter = 0;
    this.state.currencies.forEach((cur) => {
      if (counter++ < MONEY_PARTS) {
        profit += this.state['cash'.concat(cur)] > CASH_BASE ? this.getCash(cur) - CASH_BASE : 0;
      }
        // profit += this.getCash(cur) - CASH_BASE
    });
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Profit { profit } Comisions count: { comissions_sum } </h1>
        </header>
        <p className="App-intro">
          <Select
            name="form-field-name"
            value={selectedOption}
            onChange={this.handleChange}
            options={[
              { label: '30 minutes', value: 'thirtyMin' },
              { label: '1 hour', value: 'hour' },
              { label: '1 day', value: 'day'},
            ]}
          />
          {this.state.currencies.map(c =>
            // this.getCash(c) > 100 &&
            [
              <h3> {c} - PROFIT: { this.getCash(c) - CASH_BASE }</h3>,
              //this.drawChart(c),
            ],
          )}
        </p>
      </div>
    );
  }
}


export default App;
