"""This file is part of the PennAI library.

Copyright (C) 2017 Epistasis Lab, University of Pennsylvania

PennAI is maintained by:
    - Heather Williams (hwilli@upenn.edu)
    - Weixuan Fu (weixuanf@pennmedicine.upenn.edu)
    - William La Cava (lacava@upenn.edu)
    - and many other generous open source contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
from glob import glob
import pandas as pd
import json

def get_metafeatures(d):
        """Fetch dataset metafeatures from file"""
        # print('fetching data for', d)
        # payload={}
        # # payload = {'metafeatures'}
        try:
           with open(d+'/metafeatures.json') as data_file:    
                   data = json.load(data_file)
            # data = json.loads(r.read().decode(r.info().get_param('charset')
            #                           or 'utf-8'))[0]
        except Exception as e:
            print('exception when grabbing metafeature data for',d)
            raise e
        
        df = pd.DataFrame.from_records(data,columns=data.keys(),index=[0])
        df['dataset'] = d
        df.sort_index(axis=1, inplace=True)

        # print('df:',df)
        return df

frames = []
for f in glob('mock_experiment/metafeatures/api/datasets/*'):
    df = get_metafeatures(f)
    frames.append(df)

dfa = pd.concat(frames)
print(dfa)
for c in dfa.columns:
    print(c)
print('cols with missing values:')
missing_cols = [col for col in dfa.columns if dfa[col].isna().any()]
for m in missing_cols:
    print(m)
